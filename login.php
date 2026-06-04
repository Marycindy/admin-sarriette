<?php
session_start();
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode(['success' => false, 'message' => 'Method not allowed']);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true) ?: $_POST;
$username = trim($input['username'] ?? '');
$password = trim($input['password'] ?? '');

// HARDCODED LOGIN - WORKS IMMEDIATELY
if ($username === 'admin' && $password === 'admin123') {
    $_SESSION['admin_id'] = 1;
    $_SESSION['admin_name'] = 'Administrator';
    $_SESSION['admin_role'] = 'superadmin';
    $_SESSION['admin_logged_in'] = true;
    
    echo json_encode([
        'success' => true,
        'name' => 'Administrator',
        'role' => 'superadmin'
    ]);
    exit;
}

echo json_encode(['success' => false, 'message' => 'Invalid credentials. Use admin / admin123']);
?>