# Requirements Document

## Introduction

Web aplikasi berbasis React yang memungkinkan pengguna untuk mendownload file atau folder dari Google Drive dengan lebih mudah. Aplikasi ini menjadi alternatif ketika download langsung dari Google Drive mengalami kendala seperti file terlalu besar, quota exceeded, atau pembatasan lainnya.

## Glossary

- **Drive_Link_Parser**: Komponen yang mengekstrak file ID dari berbagai format URL Google Drive
- **Download_Manager**: Komponen yang mengelola proses download file
- **File_Metadata_Fetcher**: Komponen yang mengambil informasi file dari Google Drive API
- **Progress_Tracker**: Komponen yang menampilkan progress download
- **User_Interface**: Antarmuka pengguna untuk input link dan melihat status download

## Requirements

### Requirement 1: Parse Google Drive Link

**User Story:** As a user, I want to paste any Google Drive link format, so that I can easily initiate a download without manually extracting file IDs.

#### Acceptance Criteria

1. WHEN a user pastes a Google Drive file link THEN the Drive_Link_Parser SHALL extract the file ID from the URL
2. WHEN a user pastes a Google Drive folder link THEN the Drive_Link_Parser SHALL extract the folder ID from the URL
3. WHEN a user pastes an invalid or non-Google Drive link THEN the Drive_Link_Parser SHALL display an error message indicating invalid link format
4. THE Drive_Link_Parser SHALL support multiple Google Drive URL formats including:
   - `https://drive.google.com/file/d/{fileId}/view`
   - `https://drive.google.com/open?id={fileId}`
   - `https://drive.google.com/drive/folders/{folderId}`

### Requirement 2: Fetch File/Folder Metadata

**User Story:** As a user, I want to see file information before downloading, so that I can verify I'm downloading the correct file.

#### Acceptance Criteria

1. WHEN a valid file ID is extracted THEN the File_Metadata_Fetcher SHALL retrieve file name, size, and type from Google Drive API
2. WHEN a valid folder ID is extracted THEN the File_Metadata_Fetcher SHALL retrieve folder name and list of files within the folder
3. IF the file or folder is not accessible THEN the File_Metadata_Fetcher SHALL display an appropriate error message
4. WHEN metadata is successfully fetched THEN the User_Interface SHALL display file name, size (formatted), and file type

### Requirement 3: Download Single File

**User Story:** As a user, I want to download a single file from Google Drive, so that I can get files that are difficult to download directly.

#### Acceptance Criteria

1. WHEN a user clicks the download button for a file THEN the Download_Manager SHALL initiate the download process
2. WHILE a download is in progress THEN the Progress_Tracker SHALL display download percentage and speed
3. WHEN a download completes successfully THEN the User_Interface SHALL notify the user and provide the downloaded file
4. IF a download fails THEN the Download_Manager SHALL display an error message and offer retry option

### Requirement 4: Download Folder Contents

**User Story:** As a user, I want to download all files from a Google Drive folder, so that I can batch download multiple files at once.

#### Acceptance Criteria

1. WHEN a user selects a folder to download THEN the Download_Manager SHALL list all files in the folder
2. WHEN a user initiates folder download THEN the Download_Manager SHALL download files sequentially or provide option for batch download
3. WHILE folder download is in progress THEN the Progress_Tracker SHALL display overall progress and individual file progress
4. WHEN all files in a folder are downloaded THEN the User_Interface SHALL provide option to download as ZIP archive

### Requirement 5: User Interface

**User Story:** As a user, I want a clean and intuitive interface, so that I can easily use the application without confusion.

#### Acceptance Criteria

1. THE User_Interface SHALL display a prominent input field for pasting Google Drive links
2. THE User_Interface SHALL display a download button that is enabled only when a valid link is detected
3. WHEN a download is queued THEN the User_Interface SHALL display the file in a download queue list
4. THE User_Interface SHALL be responsive and work on both desktop and mobile devices
5. THE User_Interface SHALL provide visual feedback for all user actions (loading states, success, errors)

### Requirement 6: Error Handling

**User Story:** As a user, I want clear error messages, so that I understand what went wrong and how to fix it.

#### Acceptance Criteria

1. IF Google Drive API returns quota exceeded error THEN the User_Interface SHALL display message explaining the limitation and suggest waiting
2. IF file is private or requires authentication THEN the User_Interface SHALL inform user that file access is restricted
3. IF network error occurs during download THEN the Download_Manager SHALL attempt automatic retry up to 3 times
4. WHEN any error occurs THEN the User_Interface SHALL display user-friendly error message with suggested action

### Requirement 7: API Integration

**User Story:** As a developer, I want proper API integration, so that the application can reliably communicate with Google Drive.

#### Acceptance Criteria

1. THE application SHALL use Google Drive API v3 for fetching file metadata
2. THE application SHALL handle API rate limiting gracefully
3. WHEN API key is required THEN the application SHALL securely manage API credentials
4. THE application SHALL implement proper CORS handling for API requests
