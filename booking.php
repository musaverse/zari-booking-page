<?php
/**
 * ZARI — reservation request endpoint
 *
 * Receives the JSON posted by assets/js/app.js, validates it, stores a copy
 * outside the public web root (or in ./data, protected by .htaccess), emails
 * the reservations desk, and sends the guest an acknowledgement.
 *
 * Prices are recalculated by the reservations team on confirmation; the
 * amounts here are what the guest saw, recorded for reference.
 */

declare(strict_types=1);

const RESERVATIONS_TO   = 'arrivals@thezari.co.in';
const MAIL_FROM         = 'ZARI Reservations <arrivals@thezari.co.in>';
const ALLOWED_PROPERTIES = ['miln-town' => 'Miln Town', 'bijapur-lodge' => 'Bijapur Lodge'];
const MAX_BODY_BYTES    = 32768;

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

function respond(int $code, array $data): void
{
    http_response_code($code);
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    respond(405, ['ok' => false, 'error' => 'method_not_allowed']);
}

$raw = file_get_contents('php://input', false, null, 0, MAX_BODY_BYTES + 1);
if ($raw === false || strlen($raw) > MAX_BODY_BYTES) {
    respond(413, ['ok' => false, 'error' => 'too_large']);
}

$b = json_decode($raw, true);
if (!is_array($b)) {
    respond(400, ['ok' => false, 'error' => 'invalid_json']);
}

/* ---------- helpers ---------- */
function str($v, int $max = 200): string
{
    $s = is_scalar($v) ? trim((string) $v) : '';
    $s = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', '', $s) ?? '';
    return mb_substr($s, 0, $max);
}
function oneLine(string $s): string
{
    return trim(preg_replace('/[\r\n]+/', ' ', $s) ?? '');
}
function validDate(string $d): bool
{
    $dt = DateTime::createFromFormat('Y-m-d', $d);
    return $dt && $dt->format('Y-m-d') === $d;
}
function inr($n): string
{
    return $n === null ? 'On request' : '₹' . number_format((float) $n, 0, '.', ',');
}

/* ---------- validate ---------- */
$propertyId = str($b['property']['id'] ?? '', 40);
if (!isset(ALLOWED_PROPERTIES[$propertyId])) {
    respond(422, ['ok' => false, 'error' => 'unknown_property']);
}
$propertyName = ALLOWED_PROPERTIES[$propertyId];

$checkIn  = str($b['checkIn'] ?? '', 10);
$checkOut = str($b['checkOut'] ?? '', 10);
if (!validDate($checkIn) || !validDate($checkOut) || $checkOut <= $checkIn || $checkIn < date('Y-m-d', strtotime('-1 day'))) {
    respond(422, ['ok' => false, 'error' => 'invalid_dates']);
}
$nights = (int) ((strtotime($checkOut) - strtotime($checkIn)) / 86400);

$g = is_array($b['guest'] ?? null) ? $b['guest'] : [];
$guest = [
    'firstName' => oneLine(str($g['firstName'] ?? '', 80)),
    'lastName'  => oneLine(str($g['lastName'] ?? '', 80)),
    'email'     => oneLine(str($g['email'] ?? '', 160)),
    'code'      => oneLine(str($g['code'] ?? '', 6)),
    'phone'     => oneLine(str($g['phone'] ?? '', 30)),
    'arrival'   => oneLine(str($g['arrival'] ?? '', 60)),
    'from'      => oneLine(str($g['from'] ?? '', 80)),
    'occasion'  => array_slice(array_map(fn($o) => oneLine(str($o, 30)), is_array($g['occasion'] ?? null) ? $g['occasion'] : []), 0, 6),
    'notes'     => str($g['notes'] ?? '', 2000),
];
if ($guest['firstName'] === '' || $guest['lastName'] === '' || !filter_var($guest['email'], FILTER_VALIDATE_EMAIL)
    || strlen(preg_replace('/\D/', '', $guest['phone']) ?? '') < 6) {
    respond(422, ['ok' => false, 'error' => 'invalid_guest']);
}

$rooms = [];
foreach (array_slice(is_array($b['rooms'] ?? null) ? $b['rooms'] : [], 0, 12) as $r) {
    if (!is_array($r)) continue;
    $rooms[] = [
        'room'     => oneLine(str($r['room'] ?? '', 80)),
        'plan'     => oneLine(str($r['plan'] ?? '', 60)),
        'adults'   => max(1, min(10, (int) ($r['adults'] ?? 1))),
        'children' => max(0, min(6, (int) ($r['children'] ?? 0))),
        'nightly'  => isset($r['nightly']) && is_numeric($r['nightly']) ? (float) $r['nightly'] : null,
        'total'    => isset($r['total']) && is_numeric($r['total']) ? (float) $r['total'] : null,
    ];
}
if (!$rooms) {
    respond(422, ['ok' => false, 'error' => 'no_rooms']);
}

$total   = isset($b['total']) && is_numeric($b['total']) ? (float) $b['total'] : null;
$taxes   = isset($b['taxes']) && is_numeric($b['taxes']) ? (float) $b['taxes'] : null;
$advance = isset($b['advanceDue']) && is_numeric($b['advanceDue']) ? (float) $b['advanceDue'] : null;

// Keep the client reference if it is well formed, otherwise mint one.
$ref = str($b['ref'] ?? '', 20);
if (!preg_match('/^ZR-[A-Z]{1,4}-[A-Z0-9]{6}$/', $ref)) {
    $ref = 'ZR-' . strtoupper(substr(preg_replace('/[^a-z]/', '', $propertyId), 0, 2)) . '-' . strtoupper(substr(bin2hex(random_bytes(4)), 0, 6));
}

$record = [
    'ref' => $ref, 'property' => $propertyName, 'checkIn' => $checkIn, 'checkOut' => $checkOut, 'nights' => $nights,
    'rooms' => $rooms, 'taxes' => $taxes, 'total' => $total, 'advanceDue' => $advance, 'guest' => $guest,
    'receivedAt' => date('c'), 'ip' => $_SERVER['REMOTE_ADDR'] ?? '',
];

/* ---------- store ---------- */
$dir = __DIR__ . '/data';
if (!is_dir($dir)) {
    @mkdir($dir, 0750, true);
}
@file_put_contents($dir . '/reservations.jsonl', json_encode($record, JSON_UNESCAPED_UNICODE) . "\n", FILE_APPEND | LOCK_EX);

/* ---------- email the desk ---------- */
$fmt = fn(string $d) => date('D j M Y', strtotime($d));
$lines = [];
foreach ($rooms as $r) {
    $lines[] = sprintf('  • %s — %s — %d adult(s)%s — %s',
        $r['room'], $r['plan'], $r['adults'], $r['children'] ? ", {$r['children']} child" : '', inr($r['total']));
}
$deskBody = implode("\n", array_filter([
    "New reservation request {$ref}",
    '',
    "{$propertyName}",
    "{$fmt($checkIn)} → {$fmt($checkOut)} · {$nights} night(s)",
    '',
    implode("\n", $lines),
    '',
    'Taxes: ' . inr($taxes),
    'Total: ' . inr($total),
    $advance !== null ? 'Advance to request (50%): ' . inr($advance) : 'Tariff: to be confirmed',
    '',
    "Guest: {$guest['firstName']} {$guest['lastName']}",
    "Email: {$guest['email']}",
    "Phone: {$guest['code']} {$guest['phone']}",
    "Arrival: {$guest['arrival']}",
    $guest['from'] ? "Travelling from: {$guest['from']}" : null,
    $guest['occasion'] ? 'Celebrating: ' . implode(', ', $guest['occasion']) : null,
    $guest['notes'] ? "Notes:\n{$guest['notes']}" : null,
], fn($l) => $l !== null));

$headers = [
    'From: ' . MAIL_FROM,
    'Reply-To: ' . $guest['email'],
    'Content-Type: text/plain; charset=UTF-8',
];
$sent = @mail(RESERVATIONS_TO, "=?UTF-8?B?" . base64_encode("Reservation {$ref} · {$propertyName} · {$fmt($checkIn)}") . "?=", $deskBody, implode("\r\n", $headers));

/* ---------- acknowledge the guest ---------- */
$guestBody = implode("\n", [
    "Dear {$guest['firstName']},",
    '',
    "Thank you for choosing {$propertyName}. Your reservation request {$ref} has reached us:",
    '',
    "{$fmt($checkIn)} → {$fmt($checkOut)} · {$nights} night(s)",
    implode("\n", $lines),
    $total !== null ? 'Total including taxes: ' . inr($total) : 'Tariff: our team will confirm it for your dates.',
    '',
    'Someone from the Zari team will write to you shortly to confirm, with a secure link to guarantee your stay. No payment has been taken.',
    '',
    'If anything changes, simply reply to this email.',
    '',
    'With warm regards,',
    'ZARI Reservations',
    'arrivals@thezari.co.in',
]);
@mail($guest['email'], "=?UTF-8?B?" . base64_encode("Your stay at {$propertyName} · {$ref}") . "?=", $guestBody,
    implode("\r\n", ['From: ' . MAIL_FROM, 'Reply-To: ' . RESERVATIONS_TO, 'Content-Type: text/plain; charset=UTF-8']));

respond(200, ['ok' => true, 'ref' => $ref, 'notified' => (bool) $sent]);
