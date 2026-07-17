<?php
// upload.php - File upload handler

header('Content-Type: application/json');

// Configuration
$uploadDir = __DIR__ . '/';
$jsonFile = $uploadDir . 'files.json';
$maxFileSize = 100 * 1024 * 1024; // 100MB

// Enable error reporting for debugging (remove in production)
error_reporting(E_ALL);
ini_set('display_errors', 0);

function sendResponse($success, $message, $data = null) {
    echo json_encode([
        'success' => $success,
        'message' => $message,
        'data' => $data
    ]);
    exit;
}

// Check if request is POST
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    sendResponse(false, 'Invalid request method');
}

// Check if file was uploaded
if (!isset($_FILES['file']) || $_FILES['file']['error'] !== UPLOAD_ERR_OK) {
    $errorMessage = 'File upload error';
    if (isset($_FILES['file']['error'])) {
        switch ($_FILES['file']['error']) {
            case UPLOAD_ERR_INI_SIZE:
            case UPLOAD_ERR_FORM_SIZE:
                $errorMessage = 'File is too large';
                break;
            case UPLOAD_ERR_NO_FILE:
                $errorMessage = 'No file was uploaded';
                break;
            default:
                $errorMessage = 'Unknown upload error';
        }
    }
    sendResponse(false, $errorMessage);
}

// Get form data
$file = $_FILES['file'];
$type = isset($_POST['type']) ? trim($_POST['type']) : '';
$description = isset($_POST['description']) ? trim($_POST['description']) : '';

// Validate required fields
if (empty($type) || empty($description)) {
    sendResponse(false, 'Type and description are required');
}

// Check file size
if ($file['size'] > $maxFileSize) {
    sendResponse(false, 'File is too large. Maximum size is 100MB');
}

// Get original filename
$originalFilename = basename($file['name']);
$targetFile = $uploadDir . $originalFilename;

// Check if file already exists
if (file_exists($targetFile)) {
    sendResponse(false, 'A file with this name already exists. Please rename your file.');
}

// Move uploaded file
if (!move_uploaded_file($file['tmp_name'], $targetFile)) {
    sendResponse(false, 'Failed to save uploaded file');
}

// Update files.json
try {
    // Read existing JSON
    $files = [];
    if (file_exists($jsonFile)) {
        $jsonContent = file_get_contents($jsonFile);
        $files = json_decode($jsonContent, true);
        if (!is_array($files)) {
            $files = [];
        }
    }

    // Add new file entry
    $newFile = [
        'name' => $originalFilename,
        'type' => $type,
        'description' => $description
    ];

    // Check if file already exists in JSON
    $fileExists = false;
    foreach ($files as $existingFile) {
        if ($existingFile['name'] === $originalFilename) {
            $fileExists = true;
            break;
        }
    }

    if (!$fileExists) {
        $files[] = $newFile;
    }

    // Write updated JSON
    $jsonContent = json_encode($files, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
    if (file_put_contents($jsonFile, $jsonContent) === false) {
        // If JSON update fails, delete the uploaded file
        unlink($targetFile);
        sendResponse(false, 'Failed to update file list');
    }

    sendResponse(true, 'File uploaded successfully', $newFile);

} catch (Exception $e) {
    // If anything fails, delete the uploaded file
    if (file_exists($targetFile)) {
        unlink($targetFile);
    }
    sendResponse(false, 'Error updating file list: ' . $e->getMessage());
}
?>

