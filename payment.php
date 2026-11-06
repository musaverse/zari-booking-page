<?php
/**
 * ZARI — Razorpay payments.
 *
 *   {action: "order",  ref, option: "advance"|"full"}  → creates a Razorpay order
 *   {action: "verify", ref, razorpay_order_id, razorpay_payment_id, razorpay_signature}
 *
 * The amount always comes from the stored, server-priced reservation.
 * Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET (environment, or
 * lib/config.local.php) to switch payments on.
 */

declare(strict_types=1);
require __DIR__ . '/lib/zari.php';

$b = read_json_body(8192);
if (!payments_enabled()) json_out(503, ['ok' => false, 'error' => 'payments_off']);

$ref = clean($b['ref'] ?? '', 20);
$res = $ref !== '' ? find_reservation($ref) : null;
if (!$res || ($res['quote']['onRequest'] ?? true)) json_out(404, ['ok' => false, 'error' => 'unknown_reservation']);

$keyId = zari_secret('RAZORPAY_KEY_ID');
$secret = zari_secret('RAZORPAY_KEY_SECRET');
$action = $b['action'] ?? '';

if ($action === 'order') {
    $full = ($b['option'] ?? '') === 'full' || $res['quote']['advanceDue'] === null;
    $amountInr = (float) ($full ? $res['quote']['total'] : $res['quote']['advanceDue']);
    $paise = (int) round($amountInr * 100);

    $ch = curl_init('https://api.razorpay.com/v1/orders');
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_USERPWD => $keyId . ':' . $secret,
        CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
        CURLOPT_POSTFIELDS => json_encode([
            'amount' => $paise, 'currency' => 'INR', 'receipt' => $ref,
            'notes' => ['ref' => $ref, 'property' => $res['propertyName'], 'option' => $full ? 'full' : 'advance'],
        ]),
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 20,
    ]);
    $out = curl_exec($ch);
    $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    $order = is_string($out) ? json_decode($out, true) : null;
    if ($code !== 200 || empty($order['id'])) json_out(502, ['ok' => false, 'error' => 'order_failed']);

    store_event(['type' => 'order', 'ref' => $ref, 'orderId' => $order['id'], 'amount' => $paise, 'option' => $full ? 'full' : 'advance', 'at' => date('c')]);
    json_out(200, ['ok' => true, 'orderId' => $order['id'], 'amount' => $paise, 'currency' => 'INR', 'keyId' => $keyId]);
}

if ($action === 'verify') {
    $orderId = clean($b['razorpay_order_id'] ?? '', 64);
    $paymentId = clean($b['razorpay_payment_id'] ?? '', 64);
    $sig = clean($b['razorpay_signature'] ?? '', 128);
    $expected = hash_hmac('sha256', $orderId . '|' . $paymentId, $secret);
    if ($orderId === '' || $paymentId === '' || !hash_equals($expected, $sig)) json_out(400, ['ok' => false, 'error' => 'bad_signature']);

    // Amount of the order we created for this reservation.
    $amount = null;
    foreach (file(DATA_DIR . '/reservations.jsonl', FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) ?: [] as $line) {
        $e = json_decode($line, true);
        if (($e['type'] ?? '') === 'order' && ($e['ref'] ?? '') === $ref && ($e['orderId'] ?? '') === $orderId) $amount = (int) $e['amount'];
    }
    if ($amount === null) json_out(400, ['ok' => false, 'error' => 'unknown_order']);

    store_event(['type' => 'payment', 'ref' => $ref, 'orderId' => $orderId, 'paymentId' => $paymentId, 'amount' => $amount, 'at' => date('c')]);

    $g = $res['guest'];
    $paid = inr($amount / 100);
    $balance = (float) $res['quote']['total'] - $amount / 100;
    $stay = nice_date($res['checkIn']) . ' → ' . nice_date($res['checkOut']) . " · {$res['quote']['nights']} night(s)";
    send_mail(RESERVATIONS_TO, "Paid {$paid} · {$ref} · {$res['propertyName']}", "Payment received for {$ref}\n\n{$res['propertyName']}\n{$stay}\nGuest: {$g['firstName']} {$g['lastName']} ({$g['email']})\nPaid: {$paid}\nRazorpay payment: {$paymentId}\nBalance: " . inr($balance), $g['email']);
    send_mail($g['email'], "Your stay at {$res['propertyName']} is reserved · {$ref}", implode("\n", [
        "Dear {$g['firstName']},", '',
        "Your stay at {$res['propertyName']} is reserved. Thank you.", '',
        "Reference: {$ref}", $stay, "Dining: {$res['planName']}", "Paid: {$paid}",
        $balance > 0 ? 'Balance due before arrival: ' . inr($balance) : 'Your stay is paid in full.', '',
        'Someone from the house will write to you personally before you travel.', '',
        'With warm regards,', 'ZARI Reservations', RESERVATIONS_TO,
    ]), RESERVATIONS_TO);

    json_out(200, ['ok' => true]);
}

json_out(400, ['ok' => false, 'error' => 'unknown_action']);
