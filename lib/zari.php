<?php
/**
 * ZARI — shared server helpers for booking.php and payment.php.
 *
 * Prices are always recalculated here from assets/data/properties.json
 * (the same file the website reads), never trusted from the browser.
 */

declare(strict_types=1);

const TAX_RATE       = 0.18;
const RESERVATIONS_TO = 'arrivals@thezari.co.in';
const MAIL_FROM      = 'ZARI Reservations <arrivals@thezari.co.in>';
const DATA_DIR       = __DIR__ . '/../data';

/* Optional, not committed: lib/config.local.php may define RAZORPAY_KEY_ID
   and RAZORPAY_KEY_SECRET. Environment variables of the same name also work. */
if (is_file(__DIR__ . '/config.local.php')) {
    require __DIR__ . '/config.local.php';
}

function zari_secret(string $name): string
{
    if (defined($name)) return (string) constant($name);
    $v = getenv($name);
    return $v === false ? '' : $v;
}

function payments_enabled(): bool
{
    return zari_secret('RAZORPAY_KEY_ID') !== '' && zari_secret('RAZORPAY_KEY_SECRET') !== '';
}

function json_out(int $code, array $data): void
{
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    header('X-Content-Type-Options: nosniff');
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

function read_json_body(int $max = 32768): array
{
    if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') json_out(405, ['ok' => false, 'error' => 'method_not_allowed']);
    $raw = file_get_contents('php://input', false, null, 0, $max + 1);
    if ($raw === false || strlen($raw) > $max) json_out(413, ['ok' => false, 'error' => 'too_large']);
    $b = json_decode($raw, true);
    if (!is_array($b)) json_out(400, ['ok' => false, 'error' => 'invalid_json']);
    return $b;
}

function clean($v, int $max = 200): string
{
    $s = is_scalar($v) ? trim((string) $v) : '';
    $s = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', '', $s) ?? '';
    return mb_substr($s, 0, $max);
}
function one_line(string $s): string { return trim(preg_replace('/[\r\n]+/', ' ', $s) ?? ''); }
function inr($n): string { return $n === null ? 'On request' : '₹' . number_format((float) $n, 0, '.', ','); }
function nice_date(string $d): string { return date('D j M Y', strtotime($d)); }

function properties(): array
{
    static $p = null;
    if ($p === null) {
        $p = json_decode((string) file_get_contents(__DIR__ . '/../assets/data/properties.json'), true) ?: [];
    }
    return $p;
}
function property(string $id): ?array
{
    foreach (properties() as $p) if (($p['id'] ?? '') === $id) return $p;
    return null;
}

/** Nightly price for one room at an occupancy, or null when on request. */
function nightly(array $room, string $plan, int $adults, int $children): ?float
{
    $t = $room['rates'][$plan] ?? null;
    if (!is_array($t)) return null;
    $key = $children > 0 ? "{$adults}+{$children}" : (string) $adults;
    if (isset($t[$key])) return (float) $t[$key];
    return (float) max($t);
}

/**
 * Validate the requested rooms and recalculate the stay.
 * Returns [quote, error]; error is null when valid.
 */
function price_stay(array $p, string $plan, string $in, string $out, array $rooms): array
{
    $planOk = false;
    foreach ($p['ratePlans'] as $rp) if ($rp['id'] === $plan) $planOk = true;
    if (!$planOk) return [null, 'unknown_plan'];

    $nights = (int) round((strtotime($out) - strtotime($in)) / 86400);
    if ($nights < (int) ($p['minNights'] ?? 1)) return [null, 'min_nights'];

    $byId = [];
    foreach ($p['rooms'] as $r) $byId[$r['id']] = $r;
    $count = [];
    $rows = [];
    $sub = 0.0;
    $onRequest = false;
    foreach (array_slice($rooms, 0, 12) as $line) {
        $id = clean($line['roomId'] ?? '', 60);
        if (!isset($byId[$id])) return [null, 'unknown_room'];
        $r = $byId[$id];
        $a = (int) ($line['adults'] ?? 0);
        $c = (int) ($line['children'] ?? 0);
        if ($a < 1 || $a > $r['maxAdults'] || $c < 0 || $c > $r['maxChildren'] || $a + $c > $r['maxGuests']) return [null, 'occupancy'];
        $count[$id] = ($count[$id] ?? 0) + 1;
        if ($count[$id] > $r['inventory']) return [null, 'inventory'];
        $per = nightly($r, $plan, $a, $c);
        if ($per === null) $onRequest = true; else $sub += $per * $nights;
        $rows[] = ['roomId' => $id, 'room' => $r['name'], 'adults' => $a, 'children' => $c, 'nightly' => $per, 'total' => $per === null ? null : $per * $nights];
    }
    if (!$rows) return [null, 'no_rooms'];

    $tax = $onRequest ? null : round($sub * TAX_RATE);
    $total = $onRequest ? null : $sub + $tax;
    $advance = (!$onRequest && !empty($p['advance'])) ? round($total * (float) $p['advance']) : null;
    return [[
        'nights' => $nights, 'rows' => $rows, 'subtotal' => $onRequest ? null : $sub,
        'taxes' => $tax, 'total' => $total, 'advanceDue' => $advance, 'onRequest' => $onRequest,
    ], null];
}

/* ---------- storage: one JSON line per event ---------- */
function store_event(array $rec): void
{
    if (!is_dir(DATA_DIR)) @mkdir(DATA_DIR, 0750, true);
    @file_put_contents(DATA_DIR . '/reservations.jsonl', json_encode($rec, JSON_UNESCAPED_UNICODE) . "\n", FILE_APPEND | LOCK_EX);
}
function find_reservation(string $ref): ?array
{
    $f = DATA_DIR . '/reservations.jsonl';
    if (!is_file($f)) return null;
    $found = null;
    foreach (file($f, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) ?: [] as $line) {
        $r = json_decode($line, true);
        if (is_array($r) && ($r['ref'] ?? '') === $ref && ($r['type'] ?? 'reservation') === 'reservation') $found = $r;
    }
    return $found;
}

function send_mail(string $to, string $subject, string $body, string $replyTo): bool
{
    $headers = ['From: ' . MAIL_FROM, 'Reply-To: ' . $replyTo, 'Content-Type: text/plain; charset=UTF-8'];
    return @mail($to, '=?UTF-8?B?' . base64_encode($subject) . '?=', $body, implode("\r\n", $headers));
}
