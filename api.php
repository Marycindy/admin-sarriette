<?php
header('Content-Type: application/json');
require_once __DIR__ . '/../db.php';

$action = $_GET['action'] ?? $_POST['action'] ?? '';

if ($action === 'list' || $action === '') {
    $stmt = $pdo->query("SELECT * FROM reservations ORDER BY date DESC, time DESC");
    $reservations = $stmt->fetchAll();
    
    echo json_encode([
        'success' => true,
        'data' => $reservations,
        'total' => count($reservations)
    ]);
    exit;
}

if ($action === 'stats') {
    $today = date('Y-m-d');
    
    $todayStmt = $pdo->prepare("SELECT COUNT(*) FROM reservations WHERE date = ?");
    $todayStmt->execute([$today]);
    $todayCount = $todayStmt->fetchColumn();
    
    $pendingStmt = $pdo->prepare("SELECT COUNT(*) FROM reservations WHERE status = 'pending'");
    $pendingStmt->execute();
    $pendingCount = $pendingStmt->fetchColumn();
    
    $totalCount = $pdo->query("SELECT COUNT(*) FROM reservations")->fetchColumn();
    $allCount = $pdo->query("SELECT COUNT(*) FROM reservations")->fetchColumn();
    
    echo json_encode([
        'success' => true,
        'data' => [
            'today' => $todayCount,
            'pending' => $pendingCount,
            'total' => $totalCount,
            'total_all_time' => $allCount,
            'tomorrow' => 0,
            'month_total' => $totalCount,
            'seated_today' => 0,
            'total_guests_today' => 0
        ]
    ]);
    exit;
}

if ($action === 'update_status') {
    $input = json_decode(file_get_contents('php://input'), true);
    $id = $input['id'] ?? 0;
    $status = $input['status'] ?? '';
    
    $update = $pdo->prepare("UPDATE reservations SET status = ? WHERE id = ?");
    $update->execute([$status, $id]);
    
    echo json_encode(['success' => true]);
    exit;
}

if ($action === 'delete') {
    $input = json_decode(file_get_contents('php://input'), true);
    $id = $input['id'] ?? 0;
    
    $delete = $pdo->prepare("DELETE FROM reservations WHERE id = ?");
    $delete->execute([$id]);
    
    echo json_encode(['success' => true]);
    exit;
}

echo json_encode(['success' => false, 'message' => 'Unknown action']);
?>