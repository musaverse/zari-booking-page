<?php
/**
 * ZARI — create a reservation.
 *
 * Receives the journey's JSON, recalculates the price on the server,
 * stores the reservation, emails the desk and the guest, and tells the
 * browser whether online payment is available.
 */

declare(strict_types=1);
require __DIR__ . '/lib/zari.php';

$b = read_json_body();

$p = property(clean($b['property']['id'] ?? '', 40));
if (!$p) json_out(422, ['ok' => false, 'error' => 'unknown_property']);

$in  = clean($b['checkIn'] ?? '', 10);
$out = clean($b['checkOut'] ?? '', 10);
$valid = fn(string $d) => ($dt = DateTime::createFromFormat('Y-m-d', $d)) && $dt->format('Y-m-d') === $d;
if (!$valid($in) || !$valid($out) || $out <= $in || $in < date('Y-m-d', strtotime('-1 day'))) {
    json_out(422, ['ok' => false, 'error' => 'invalid_dates']);
}

$g = is_array($b['guest'] ?? null) ? $b['guest'] : [];
$guest = [
    'firstName' => one_line(clean($g['firstName'] ?? '', 80)),
    'lastName'  => one_line(clean($g['lastName'] ?? '', 80)),
    'email'     => one_line(clean($g['email'] ?? '', 160)),
    'code'      => one_line(clean($g['code'] ?? '', 6)),
    'phone'     => one_line(clean($g['phone'] ?? '', 30)),
    'from'      => one_line(clean($g['from'] ?? '', 80)),
];
if ($guest['firstName'] === '' || $guest['lastName'] === '' || !filter_var($guest['email'], FILTER_VALIDATE_EMAIL)
    || strlen(preg_replace('/\D/', '', $guest['phone']) ?? '') < 6) {
    json_out(422, ['ok' => false, 'error' => 'invalid_guest']);
}

$t = is_array($b['touches'] ?? null) ? $b['touches'] : [];
$touches = [
    'occasion' => array_slice(array_map(fn($o) => one_line(clean($o, 30)), is_array($t['occasion'] ?? null) ? $t['occasion'] : []), 0, 6),
    'arrival'  => one_line(clean($t['arrival'] ?? '', 40)),
    'notes'    => clean($t['notes'] ?? '', 2000),
];

$plan = clean($b['plan'] ?? '', 10);
[$q, $err] = price_stay($p, $plan, $in, $out, is_array($b['rooms'] ?? null) ? $b['rooms'] : []);
if ($err) json_out(422, ['ok' => false, 'error' => $err]);

$planName = $plan;
foreach ($p['ratePlans'] as $rp) if ($rp['id'] === $plan) $planName = $rp['name'];

$ref = clean($b['ref'] ?? '', 20);
if (!preg_match('/^ZR-[A-Z]{1,4}-[A-Z0-9]{6}$/', $ref) || find_reservation($ref)) {
    $ref = 'ZR-' . strtoupper(substr(preg_replace('/[^a-z]/', '', $p['id']), 0, 2)) . '-' . strtoupper(substr(bin2hex(random_bytes(4)), 0, 6));
}

store_event([
    'type' => 'reservation', 'ref' => $ref, 'status' => $q['onRequest'] ? 'request' : 'awaiting_payment',
    'property' => $p['id'], 'propertyName' => $p['name'], 'checkIn' => $in, 'checkOut' => $out,
    'plan' => $plan, 'planName' => $planName, 'quote' => $q, 'guest' => $guest, 'touches' => $touches,
    'payOption' => ($b['payOption'] ?? '') === 'full' ? 'full' : 'advance',
    'receivedAt' => date('c'), 'ip' => $_SERVER['REMOTE_ADDR'] ?? '',
]);

/* ---------- emails ---------- */
$lines = array_map(fn($r) => sprintf('  • %s — %d adult(s)%s — %s', $r['room'], $r['adults'], $r['children'] ? ", {$r['children']} child" : '', inr($r['total'])), $q['rows']);
$stay = nice_date($in) . ' → ' . nice_date($out) . " · {$q['nights']} night(s)";

send_mail(RESERVATIONS_TO, "Reservation {$ref} · {$p['name']} · " . nice_date($in), implode("\n", array_filter([
    "New reservation {$ref}" . ($q['onRequest'] ? ' (tariff on request)' : ' (awaiting payment)'),
    '', $p['name'], $stay, "Dining: {$planName}", '', implode("\n", $lines), '',
    'Taxes: ' . inr($q['taxes']), 'Total: ' . inr($q['total']),
    $q['advanceDue'] !== null ? 'Advance: ' . inr($q['advanceDue']) : null,
    '', "Guest: {$guest['firstName']} {$guest['lastName']}", "Email: {$guest['email']}", "Phone: {$guest['code']} {$guest['phone']}",
    $guest['from'] ? "Travelling from: {$guest['from']}" : null,
    $touches['occasion'] ? 'Celebrating: ' . implode(', ', $touches['occasion']) : null,
    $touches['arrival'] ? "Arriving: {$touches['arrival']}" : null,
    $touches['notes'] ? "Notes:\n{$touches['notes']}" : null,
], fn($l) => $l !== null)), $guest['email']);

if ($q['onRequest'] || !payments_enabled()) {
    // With online payment the guest is emailed once payment succeeds instead.
    send_mail($guest['email'], "Your stay at {$p['name']} · {$ref}", implode("\n", [
        "Dear {$guest['firstName']},", '',
        "Thank you for choosing {$p['name']}. Your reservation {$ref} has reached us:", '',
        $stay, "Dining: {$planName}", implode("\n", $lines),
        $q['total'] !== null ? 'Total including taxes: ' . inr($q['total']) : 'Our team will confirm the tariff for your dates.', '',
        'Someone from the ZARI team will write to you shortly' . ($q['onRequest'] ? '.' : ', with a secure link to complete your payment.'), '',
        'With warm regards,', 'ZARI Reservations', RESERVATIONS_TO,
    ]), RESERVATIONS_TO);
}

json_out(200, [
    'ok' => true, 'ref' => $ref, 'total' => $q['total'], 'advanceDue' => $q['advanceDue'],
    'payments' => ['enabled' => !$q['onRequest'] && payments_enabled()],
]);
