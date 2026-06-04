<?php
// ============================================================
//   SARRIETTE – Admin Login Handler
//   admin/login.php
// ============================================================

session_start();
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode(['success' => false, 'message' => 'Method not allowed']);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true) ?: $_POST;
$username = trim($input['username'] ?? '');
$password = trim($input['password'] ?? '');

if (empty($username) || empty($password)) {
    echo json_encode(['success' => false, 'message' => 'Username and password are required.']);
    exit;
}

require_once '../php/db.php';

$stmt = $pdo->prepare("SELECT * FROM admin_users WHERE (username = :u OR email = :u) AND is_active = 1 LIMIT 1");
$stmt->execute([':u' => $username]);
$admin = $stmt->fetch();

if (!$admin || !password_verify($password, $admin['password_hash'])) {
    // Rate limiting could be added here
    echo json_encode(['success' => false, 'message' => 'Invalid username or password.']);
    exit;
}

// Set session
$_SESSION['admin_id']   = $admin['id'];
$_SESSION['admin_name'] = $admin['full_name'];
$_SESSION['admin_role'] = $admin['role'];
$_SESSION['admin_user'] = $admin['username'];

// Update last login
$pdo->prepare("UPDATE admin_users SET last_login = NOW() WHERE id = ?")->execute([$admin['id']]);

// Audit log
$pdo->prepare("INSERT INTO audit_log (admin_id, action, ip_address) VALUES (?,?,?)")
    ->execute([$admin['id'], 'login', $_SERVER['REMOTE_ADDR'] ?? 'unknown']);

echo json_encode([
    'success' => true,
    'name'    => $admin['full_name'],
    'role'    => $admin['role'],
]);
?>
