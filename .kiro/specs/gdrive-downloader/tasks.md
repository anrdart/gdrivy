# Implementation Plan: Google Drive Downloader

## Overview

Implementasi web aplikasi React + TypeScript untuk download file/folder dari Google Drive. Menggunakan Vite sebagai build tool, Zustand untuk state management, dan Express.js untuk backend proxy.

## Tasks

- [x] 1. Setup project structure dan dependencies
  - Initialize React + TypeScript project dengan Vite
  - Install dependencies: zustand, axios, react-icons, tailwindcss
  - Setup backend Express.js dengan TypeScript
  - Configure Vitest dan fast-check untuk testing
  - _Requirements: 7.1, 7.4_

- [x] 2. Implement Link Parser Service
  - [x] 2.1 Create LinkParserService dengan regex patterns untuk berbagai format URL
    - Support file URLs: `/file/d/{id}/view`, `/open?id={id}`
    - Support folder URLs: `/drive/folders/{id}`
    - Return ParsedLink object atau null untuk invalid URLs
    - _Requirements: 1.1, 1.2, 1.3, 1.4_

  - [x] 2.2 Write property test for Link Parsing Round Trip
    - **Property 1: Link Parsing Round Trip**
    - **Validates: Requirements 1.1, 1.2, 1.4**

  - [x] 2.3 Write property test for Invalid Link Rejection
    - **Property 2: Invalid Link Rejection**
    - **Validates: Requirements 1.3**

- [x] 3. Implement Backend API Proxy
  - [x] 3.1 Create Express server dengan CORS configuration
    - Setup middleware untuk error handling
    - Configure Google Drive API client
    - _Requirements: 7.1, 7.4_

  - [x] 3.2 Implement GET /api/metadata/:fileId endpoint
    - Fetch file metadata dari Google Drive API v3
    - Return FileMetadata atau FolderMetadata
    - Handle API errors dengan proper error codes
    - _Requirements: 2.1, 2.2, 2.3_

  - [x] 3.3 Implement GET /api/download/:fileId endpoint
    - Stream file content dengan progress headers
    - Handle large files dengan chunked transfer
    - _Requirements: 3.1_

  - [x] 3.4 Implement GET /api/folder/:folderId/files endpoint
    - List semua files dalam folder
    - Return array of FileMetadata
    - _Requirements: 4.1_

- [x] 4. Checkpoint - Backend API ready
  - Ensure all backend endpoints work correctly
  - Test dengan Postman atau curl
  - Ask user if questions arise

- [x] 5. Implement State Management
  - [x] 5.1 Create Zustand store dengan AppState interface
    - Implement state untuk currentLink, parsedLink, metadata
    - Implement downloads Map untuk tracking progress
    - Implement actions: setLink, fetchMetadata, startDownload, cancelDownload
    - _Requirements: 3.2, 4.3, 5.3_

  - [x] 5.2 Write property test for Progress Calculation Accuracy
    - **Property 6: Progress Calculation Accuracy**
    - **Validates: Requirements 3.2, 4.3**

- [x] 6. Implement Error Handling System
  - [x] 6.1 Create error types dan user-friendly messages
    - Define ErrorCode enum dengan semua error types
    - Create error message mapping dengan suggested actions
    - Implement retry logic dengan exponential backoff
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

  - [x] 6.2 Write property test for Error Message Coverage
    - **Property 7: Error Message Coverage**
    - **Validates: Requirements 6.4**

  - [x] 6.3 Write property test for Retry Limit Enforcement
    - **Property 8: Retry Limit Enforcement**
    - **Validates: Requirements 6.3**

- [x] 7. Implement UI Components
  - [x] 7.1 Create LinkInput component
    - Input field dengan paste detection
    - Real-time validation feedback
    - Submit button dengan loading state
    - _Requirements: 5.1, 5.2_

  - [x] 7.2 Write property test for Download Button State Consistency
    - **Property 4: Download Button State Consistency**
    - **Validates: Requirements 5.2**

  - [x] 7.3 Create FilePreview component
    - Display file name, size (formatted), type, icon
    - Download button dengan loading state
    - Support untuk file dan folder preview
    - _Requirements: 2.4, 3.1_

  - [x] 7.4 Write property test for Metadata Display Completeness
    - **Property 3: Metadata Display Completeness**
    - **Validates: Requirements 2.4**

  - [x] 7.5 Create DownloadProgress component
    - Progress bar dengan percentage
    - Download speed indicator
    - Cancel dan retry buttons
    - _Requirements: 3.2, 3.3, 3.4_

  - [x] 7.6 Create DownloadQueue component
    - List of queued/downloading/completed files
    - Individual progress untuk setiap file
    - Clear completed button
    - _Requirements: 5.3, 4.2_

  - [x] 7.7 Write property test for Queue Display Consistency
    - **Property 5: Queue Display Consistency**
    - **Validates: Requirements 5.3**

- [x] 8. Checkpoint - Core UI components ready
  - Ensure all components render correctly
  - Test component interactions
  - Ask user if questions arise

- [x] 9. Implement Download Manager
  - [x] 9.1 Create DownloadService untuk handle downloads
    - Implement fetchMetadata method
    - Implement downloadFile dengan progress callback
    - Implement downloadFolder untuk batch download
    - _Requirements: 3.1, 4.2, 4.4_

  - [x] 9.2 Integrate download service dengan UI components
    - Wire up LinkInput → fetchMetadata → FilePreview
    - Wire up FilePreview → startDownload → DownloadProgress
    - Handle folder download dengan queue management
    - _Requirements: 3.1, 4.1, 4.2_

- [x] 10. Implement UI Feedback States
  - [x] 10.1 Add loading states untuk semua async operations
    - Loading spinner untuk metadata fetch
    - Progress indicator untuk downloads
    - Skeleton loading untuk file list
    - _Requirements: 5.5_

  - [x] 10.2 Add success dan error notifications
    - Toast notifications untuk download complete
    - Error alerts dengan suggested actions
    - _Requirements: 5.5, 6.4_

  - [x] 10.3 Write property test for UI Feedback State Machine
    - **Property 9: UI Feedback State Machine**
    - **Validates: Requirements 5.5**

- [x] 11. Styling dan Responsive Design
  - [x] 11.1 Apply Tailwind CSS styling
    - Clean, modern design
    - Consistent color scheme
    - Proper spacing dan typography
    - _Requirements: 5.4_

  - [x] 11.2 Implement responsive layout
    - Mobile-first approach
    - Breakpoints untuk tablet dan desktop
    - Touch-friendly buttons dan inputs
    - _Requirements: 5.4_

- [x] 12. Final Integration dan Testing
  - [x] 12.1 Wire semua components di App.tsx
    - Setup routing jika diperlukan
    - Connect state management
    - Handle global error boundary
    - _Requirements: All_

  - [x] 12.2 Write integration tests
    - Test full flow: paste link → fetch metadata → download
    - Test error scenarios
    - _Requirements: All_

- [x] 13. Final Checkpoint
  - Ensure all tests pass
  - Verify all requirements are met
  - Ask user if questions arise

## Notes

- All tasks are required for comprehensive testing
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases
- Backend requires Google Drive API key - user will need to provide this
