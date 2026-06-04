<?php
// ============================================================
//   SARRIETTE – Admin Reservations API
//   admin/api.php
// ============================================================

session_start();
header('Content-Type: application/json');

// Auth check
if (!isset($_SESSION['admin_id'])) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'Unauthorized']);
    exit;
}

require_once '../php/db.php';

$action = $_GET['action'] ?? $_POST['action'] ?? (json_decode(file_get_contents('php://input'), true)['action'] ?? '');
$input  = json_decode(file_get_contents('php://input'), true) ?: [];

switch ($action) {

    // ---- GET ALL RESERVATIONS ----
    case 'list':
        $status = $_GET['status'] ?? '';
        $date   = $_GET['date'] ?? '';
        $search = $_GET['search'] ?? '';
        $page   = max(1, (int)($_GET['page'] ?? 1));
        $limit  = 20;
        $offset = ($page - 1) * $limit;

        $where = ['1=1'];
        $params = [];
        if ($status) { $where[] = 'r.status = :status'; $params[':status'] = $status; }
        if ($date)   { $where[] = 'r.date = :date';     $params[':date']   = $date; }
        if ($search) {
            $where[] = '(r.name LIKE :s OR r.email LIKE :s OR r.phone LIKE :s OR r.reservation_code LIKE :s)';
            $params[':s'] = '%' . $search . '%';
        }
        $whereStr = implode(' AND ', $where);

        $total = $pdo->prepare("SELECT COUNT(*) FROM reservations r WHERE $whereStr");
        $total->execute($params);
        $totalCount = $total->fetchColumn();

        $stmt = $pdo->prepare("SELECT * FROM reservations r WHERE $whereStr ORDER BY r.date ASC, r.time ASC LIMIT $limit OFFSET $offset");
        $stmt->execute($params);
        $reservations = $stmt->fetchAll();

        echo json_encode([
            'success' => true,
            'data'    => $reservations,
            'total'   => (int)$totalCount,
            'pages'   => ceil($totalCount / $limit),
            'page'    => $page,
        ]);
        break;

    // ---- GET STATS ----
    case 'stats':
        $today     = date('Y-m-d');
        $tomorrow  = date('Y-m-d', strtotime('+1 day'));
        $thisMonth = date('Y-m');

        $stats = [];
        $stats['today']          = $pdo->query("SELECT COUNT(*) FROM reservations WHERE date = '$today'")->fetchColumn();
        $stats['tomorrow']       = $pdo->query("SELECT COUNT(*) FROM reservations WHERE date = '$tomorrow'")->fetchColumn();
        $stats['pending']        = $pdo->query("SELECT COUNT(*) FROM reservations WHERE status = 'pending'")->fetchColumn();
        $stats['confirmed']      = $pdo->query("SELECT COUNT(*) FROM reservations WHERE status = 'confirmed' AND date >= '$today'")->fetchColumn();
        $stats['month_total']    = $pdo->query("SELECT COUNT(*) FROM reservations WHERE DATE_FORMAT(date,'%Y-%m') = '$thisMonth'")->fetchColumn();
        $stats['total_all_time'] = $pdo->query("SELECT COUNT(*) FROM reservations")->fetchColumn();
        $stats['seated_today']   = $pdo->query("SELECT COUNT(*) FROM reservations WHERE date = '$today' AND status = 'seated'")->fetchColumn();
        $stats['completed_today']= $pdo->query("SELECT COUNT(*) FROM reservations WHERE date = '$today' AND status = 'completed'")->fetchColumn();
        $stats['total_guests_today'] = $pdo->query("SELECT COALESCE(SUM(CASE WHEN guests='7-10' THEN 8 WHEN guests='10+' THEN 12 ELSE CAST(guests AS UNSIGNED) END),0) FROM reservations WHERE date='$today' AND status NOT IN ('cancelled','no_show')")->fetchColumn();

        echo json_encode(['success' => true, 'data' => $stats]);
        break;

    // ---- UPDATE STATUS ----
    case 'update_status':
        $id     = (int)($input['id'] ?? 0);
        $status = $input['status'] ?? '';
        $allowed = ['pending','confirmed','seated','completed','cancelled','no_show'];
        if (!$id || !in_array($status, $allowed)) {
            echo json_encode(['success' => false, 'message' => 'Invalid data']); exit;
        }
        $extra = ($status === 'seated') ? ', checked_in = 1, checked_in_at = NOW(), checked_in_by = ' . $_SESSION['admin_id'] : '';
        $pdo->prepare("UPDATE reservations SET status = :s$extra WHERE id = :id")->execute([':s' => $status, ':id' => $id]);
        $pdo->prepare("INSERT INTO audit_log (admin_id,action,target_id,target_type,details) VALUES (?,?,?,?,?)")
            ->execute([$_SESSION['admin_id'], 'update_status', $id, 'reservation', "Status changed to: $status"]);
        echo json_encode(['success' => true]);
        break;

    // ---- CHECK IN BY CODE ----
    case 'checkin':
        $code = strtoupper(trim($input['code'] ?? ''));
        if (!$code) { echo json_encode(['success' => false, 'message' => 'Code required']); exit; }
        $stmt = $pdo->prepare("SELECT * FROM reservations WHERE reservation_code = :c LIMIT 1");
        $stmt->execute([':c' => $code]);
        $res = $stmt->fetch();
        if (!$res) {
            echo json_encode(['success' => false, 'message' => 'Reservation code not found.']); exit;
        }
        if (in_array($res['status'], ['cancelled', 'no_show'])) {
            echo json_encode(['success' => false, 'message' => 'This reservation has been ' . $res['status'] . '.']); exit;
        }
        if ($res['checked_in']) {
            echo json_encode(['success' => false, 'message' => 'Guest already checked in.', 'data' => $res]); exit;
        }
        $pdo->prepare("UPDATE reservations SET status='seated', checked_in=1, checked_in_at=NOW(), checked_in_by=? WHERE id=?")
            ->execute([$_SESSION['admin_id'], $res['id']]);
        $res['status'] = 'seated'; $res['checked_in'] = 1;
        $pdo->prepare("INSERT INTO audit_log (admin_id,action,target_id,target_type,details) VALUES (?,?,?,?,?)")
            ->execute([$_SESSION['admin_id'], 'checkin', $res['id'], 'reservation', "Checked in: $code"]);
        echo json_encode(['success' => true, 'data' => $res]);
        break;

    // ---- DELETE RESERVATION ----
    case 'delete':
        $id = (int)($input['id'] ?? 0);
        if (!$id) { echo json_encode(['success' => false, 'message' => 'ID required']); exit; }
        $pdo->prepare("DELETE FROM reservations WHERE id = ?")->execute([$id]);
        echo json_encode(['success' => true]);
        break;

    // ---- UPCOMING RESERVATIONS (next 7 days) ----
    case 'upcoming':
        $stmt = $pdo->query("SELECT date, COUNT(*) as count, SUM(CASE WHEN guests='7-10' THEN 8 WHEN guests='10+' THEN 12 ELSE CAST(guests AS UNSIGNED) END) as total_guests FROM reservations WHERE date BETWEEN CURDATE() AND DATE_ADD(CURDATE(),INTERVAL 7 DAY) AND status NOT IN ('cancelled','no_show') GROUP BY date ORDER BY date ASC");
        echo json_encode(['success' => true, 'data' => $stmt->fetchAll()]);
        break;

    default:
        echo json_encode(['success' => false, 'message' => 'Unknown action']);
}
?>