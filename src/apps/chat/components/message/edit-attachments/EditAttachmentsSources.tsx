import * as React from 'react';
import type { FileWithHandle } from 'browser-fs-access';

import { Box } from '@mui/joy';

import { useBrowseCapability } from '~/modules/browse/store-module-browsing';

import type { AttachmentDraftsStoreApi } from '~/common/attachment-drafts/store-attachment-drafts_slice';
import { AttachmentDraftsList } from '~/common/attachment-drafts/attachment-drafts-ui/AttachmentDraftsList';
import { AttachmentSourcesMemo } from '~/common/attachment-drafts/attachment-sources/AttachmentSources';
import { useAttachmentDrafts } from '~/common/attachment-drafts/useAttachmentDrafts';
import { useGoogleDrivePicker } from '~/common/attachment-drafts/attachment-sources/useGoogleDrivePicker';
import { useWebAttachmentModal } from '~/common/attachment-drafts/attachment-sources/useWebAttachmentModal';

import { supportsCameraCapture } from '~/common/components/camera/useCameraCapture';
import { useCameraCaptureDialog } from '~/common/components/camera/useCameraCaptureDialog';
import { supportsScreenCapture } from '~/common/util/screenCaptureUtils';
import { useIsMobile } from '~/common/components/useMatchMedia';


/**
 * Compact attachment authoring bar for message edit mode.
 * Renders: [+] source dropdown + scrollable draft buttons + source modals.
 *
 * Lazy-loaded via React.lazy() in ChatMessage.tsx — only loaded when the user enters edit mode.
 */
export function EditAttachmentsSources(props: {
  attachmentDraftsStoreApi: AttachmentDraftsStoreApi;
}) {

  // external state
  const isMobile = useIsMobile();
  const browseCapability = useBrowseCapability();

  // attachment drafts hook — wired to the temporary standalone store
  const {
    attachmentDrafts,
    attachAppendClipboardItems, attachAppendCloudFile, attachAppendFile, attachAppendUrl,
  } = useAttachmentDrafts(props.attachmentDraftsStoreApi, false /*no URL-on-paste*/, false /*no image hints*/);


  // Callbacks for attachment sources

  const handleAttachFiles = React.useCallback(async (files: FileWithHandle[], _errorMessage: string | null) => {
    for (const file of files)
      await attachAppendFile('file-open', file);
  }, [attachAppendFile]);

  const handleAttachCameraImage = React.useCallback((file: FileWithHandle) => {
    void attachAppendFile('camera', file);
  }, [attachAppendFile]);

  const { openCameraCapture } = useCameraCaptureDialog();

  const handleOpenCamera = React.useCallback(async () => {
    const file = await openCameraCapture();
    if (file) handleAttachCameraImage(file);
  }, [openCameraCapture, handleAttachCameraImage]);

  const handleAttachScreenCapture = React.useCallback((file: File) => {
    void attachAppendFile('screencapture', file);
  }, [attachAppendFile]);

  const handleAttachWebLinks = React.useCallback(async (links: { url: string }[]) => {
    links.forEach(link => void attachAppendUrl('input-link', link.url));
  }, [attachAppendUrl]);

  const { openWebInputDialog, webInputDialogComponent } = useWebAttachmentModal(handleAttachWebLinks);
  const { openGoogleDrivePicker, googleDrivePickerComponent } = useGoogleDrivePicker(attachAppendCloudFile, isMobile);

  return (
    <Box sx={{
      display: 'flex',
      alignItems: 'center',
      gap: 1,
      minHeight: '2.25rem',
    }}>

      {/* [+] Source Menu */}
      <AttachmentSourcesMemo
        mode='menu-compact'
        canBrowse={browseCapability.inComposer}
        hasScreenCapture={supportsScreenCapture}
        hasCamera={supportsCameraCapture()}
        onAttachClipboard={attachAppendClipboardItems}
        onAttachFiles={handleAttachFiles}
        onAttachScreenCapture={handleAttachScreenCapture}
        onOpenCamera={handleOpenCamera}
        onOpenGoogleDrivePicker={openGoogleDrivePicker}
        onOpenWebInput={openWebInputDialog}
      />

      {/* Draft Buttons (scrollable) */}
      <AttachmentDraftsList
        attachmentDraftsStoreApi={props.attachmentDraftsStoreApi}
        attachmentDrafts={attachmentDrafts}
      />

      {/* Modals */}
      {webInputDialogComponent}
      {googleDrivePickerComponent}

    </Box>
  );
}
