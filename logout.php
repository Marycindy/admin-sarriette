<?php
session_start();
require_once '../db.php';

if (isset($_SESSION['admin_id'])) {
    $pdo->prepare("INSERT INTO audit_log (admin_id, action, ip_address) VALUES (?,?,?)")
        ->execute([$_SESSION['admin_id'], 'logout', $_SERVER['REMOTE_ADDR'] ?? 'unknown']);
}

session_destroy();
header('Location: login.html');
exit;
?>