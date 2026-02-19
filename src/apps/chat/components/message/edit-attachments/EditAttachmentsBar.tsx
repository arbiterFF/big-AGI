import * as React from 'react';
import type { FileWithHandle } from 'browser-fs-access';

import { Box, Dropdown, IconButton, ListItemDecorator, Menu, MenuButton, MenuItem, Tooltip, Typography } from '@mui/joy';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import AttachFileRoundedIcon from '@mui/icons-material/AttachFileRounded';
import ContentPasteGoIcon from '@mui/icons-material/ContentPasteGo';
import LanguageRoundedIcon from '@mui/icons-material/LanguageRounded';
import ScreenshotMonitorIcon from '@mui/icons-material/ScreenshotMonitor';

import type { AttachmentDraftId } from '~/common/attachment-drafts/attachment.types';
import type { AttachmentDraftsStoreApi } from '~/common/attachment-drafts/store-attachment-drafts_slice';
import type { DMessageDocPart, DMessageImageRefPart } from '~/common/stores/chat/chat.fragments';
import { addSnackbar } from '~/common/components/snackbar/useSnackbarsStore';
import { openFileForAttaching } from '~/common/components/ButtonAttachFiles';
import { supportsClipboardRead } from '~/common/util/clipboardUtils';
import { supportsScreenCapture, takeScreenCapture } from '~/common/util/screenCaptureUtils';
import { useAttachmentDrafts } from '~/common/attachment-drafts/useAttachmentDrafts';
import { useBrowseCapability } from '~/modules/browse/store-module-browsing';

import { LLMAttachmentButtonMemo } from '../../composer/llmattachments/LLMAttachmentButton';
import { LLMAttachmentMenu } from '../../composer/llmattachments/LLMAttachmentMenu';
import type { LLMAttachmentDraft } from '../../composer/llmattachments/useLLMAttachmentDrafts';
import { ViewDocPartModal } from '../fragments-content/ViewDocPartModal';
import { ViewImageRefPartModal } from '../fragments-content/ViewImageRefPartModal';
import { useWebInputModal } from '../../composer/WebInputModal';


const _styles = {

  bar: {
    display: 'flex',
    alignItems: 'center',
    gap: 1,
    py: 0.5,
  } as const,

  scrollArea: {
    position: 'relative',
    flexGrow: 1,
    minWidth: 0,
  } as const,

  scrollInner: {
    overflowX: 'auto',
    display: 'flex',
    alignItems: 'center',
    gap: 0.5,
  } as const,

} as const;


/**
 * Attachment bar for ChatMessage edit mode.
 *
 * Shows an [+ Add] button that opens a menu with attachment sources (File, Clipboard, Web, Screen),
 * and a scrollable list of attachment draft buttons. Each draft button opens the converter menu.
 *
 * Uses a standalone AttachmentDraftsStoreApi (not the per-conversation one used by the Composer).
 */
export function EditAttachmentsBar(props: {
  attachmentDraftsStoreApi: AttachmentDraftsStoreApi;
  isMobile: boolean;
}) {

  // state
  const [draftMenu, setDraftMenu] = React.useState<{ anchor: HTMLAnchorElement, attachmentDraftId: AttachmentDraftId } | null>(null);
  const [viewerDocPart, setViewerDocPart] = React.useState<DMessageDocPart | null>(null);
  const [viewerImageRefPart, setViewerImageRefPart] = React.useState<DMessageImageRefPart | null>(null);

  // external state
  const hasBrowseCapability = useBrowseCapability().inComposer;

  // attachment drafts from standalone store
  const {
    attachmentDrafts,
    attachAppendClipboardItems,
    attachAppendFile,
    attachAppendUrl,
  } = useAttachmentDrafts(props.attachmentDraftsStoreApi, true, false);


  // Attachment source handlers

  const handleAttachFiles = React.useCallback(async (files: FileWithHandle[], errorMessage: string | null) => {
    if (errorMessage)
      addSnackbar({ key: 'attach-files-open-fail', message: `Unable to open files: ${errorMessage}`, type: 'issue' });
    for (const file of files)
      await attachAppendFile('file-open', file)
        .catch((error: any) => addSnackbar({ key: 'attach-file-open-fail', message: `Unable to attach "${file.name}" (${error?.message || error?.toString() || 'unknown'})`, type: 'issue' }));
  }, [attachAppendFile]);

  const handleAttachFilePicker = React.useCallback(() => {
    void openFileForAttaching(true, handleAttachFiles);
  }, [handleAttachFiles]);

  const handleAttachWebLinks = React.useCallback(async (links: { url: string }[]) => {
    links.forEach(link => void attachAppendUrl('input-link', link.url));
  }, [attachAppendUrl]);

  const { openWebInputDialog, webInputDialogComponent } = useWebInputModal(handleAttachWebLinks);

  const handleAttachScreenCapture = React.useCallback(async () => {
    try {
      const file = await takeScreenCapture();
      if (file)
        void attachAppendFile('screencapture', file);
    } catch (error: any) {
      const message = error instanceof Error ? error.message : String(error);
      addSnackbar({ key: 'attach-screen-fail', message: `Screen capture issue: ${message}`, type: 'issue' });
    }
  }, [attachAppendFile]);


  // Convert AttachmentDrafts to LLMAttachmentDrafts (simplified - mark all as supported)
  const llmAttachmentDrafts: LLMAttachmentDraft[] = React.useMemo(() =>
    attachmentDrafts.map((draft): LLMAttachmentDraft => ({
      attachmentDraft: draft,
      llmSupportsAllFragments: true,
      llmSupportsTextFragments: true,
      llmTokenCountApprox: null,
      hasImageFragments: false,
    })),
  [attachmentDrafts]);


  // Draft menu handlers

  const handleDraftMenuToggle = React.useCallback((attachmentDraftId: AttachmentDraftId, anchor: HTMLAnchorElement) => {
    setDraftMenu(prev => prev?.attachmentDraftId === attachmentDraftId ? null : { anchor, attachmentDraftId });
  }, []);

  const handleDraftMenuHide = React.useCallback(() => setDraftMenu(null), []);

  const handleViewDocPart = React.useCallback((docPart: DMessageDocPart) => {
    setViewerDocPart(docPart);
  }, []);

  const handleViewImageRefPart = React.useCallback((imageRefPart: DMessageImageRefPart) => {
    setViewerImageRefPart(imageRefPart);
  }, []);


  // Derived state for draft menu

  const itemMenuAnchor = draftMenu?.anchor;
  const itemMenuAttachmentDraftId = draftMenu?.attachmentDraftId;
  const itemMenuLLMDraft = itemMenuAttachmentDraftId
    ? llmAttachmentDrafts.find(la => la.attachmentDraft.id === itemMenuAttachmentDraftId)
    : undefined;
  const itemMenuIndex = itemMenuLLMDraft ? llmAttachmentDrafts.indexOf(itemMenuLLMDraft) : -1;

  const hasAttachments = attachmentDrafts.length >= 1;


  return <>

    {/* Attachment drafts bar */}
    <Box sx={_styles.bar}>

      {/* [+ Add] button with dropdown menu */}
      <Dropdown>
        <Tooltip arrow disableInteractive title='Add attachment to this message'>
          <MenuButton
            slots={{ root: IconButton }}
            slotProps={{ root: { size: 'sm', variant: 'outlined', color: 'neutral' } }}
          >
            <AddCircleOutlineIcon />
          </MenuButton>
        </Tooltip>
        <Menu placement='bottom-start' sx={{ minWidth: 180 }}>

          {/* Attach file */}
          <MenuItem onClick={handleAttachFilePicker}>
            <ListItemDecorator><AttachFileRoundedIcon /></ListItemDecorator>
            Attach File
          </MenuItem>

          {/* Paste clipboard */}
          {supportsClipboardRead() && (
            <MenuItem onClick={attachAppendClipboardItems}>
              <ListItemDecorator><ContentPasteGoIcon /></ListItemDecorator>
              Paste Clipboard
            </MenuItem>
          )}

          {/* Web URL */}
          <MenuItem onClick={openWebInputDialog} disabled={!hasBrowseCapability}>
            <ListItemDecorator><LanguageRoundedIcon /></ListItemDecorator>
            Web Page
          </MenuItem>

          {/* Screen capture */}
          {supportsScreenCapture && (
            <MenuItem onClick={handleAttachScreenCapture}>
              <ListItemDecorator><ScreenshotMonitorIcon /></ListItemDecorator>
              Screen Capture
            </MenuItem>
          )}

        </Menu>
      </Dropdown>

      {/* Scrollable attachment drafts */}
      {hasAttachments && (
        <Box sx={_styles.scrollArea}>
          <Box sx={_styles.scrollInner}>
            {llmAttachmentDrafts.map((llmAttachment) =>
              <LLMAttachmentButtonMemo
                key={llmAttachment.attachmentDraft.id}
                llmAttachment={llmAttachment}
                menuShown={llmAttachment.attachmentDraft.id === itemMenuAttachmentDraftId}
                onToggleMenu={handleDraftMenuToggle}
                onViewImageRefPart={handleViewImageRefPart}
              />,
            )}
          </Box>
        </Box>
      )}

      {/* Inline label when no attachments */}
      {!hasAttachments && (
        <Typography level='body-xs' sx={{ color: 'text.tertiary', userSelect: 'none' }}>
          Add attachments
        </Typography>
      )}

    </Box>


    {/* Web Input Dialog */}
    {webInputDialogComponent}

    {/* Doc Viewer Modal */}
    {!!viewerDocPart && (
      <ViewDocPartModal docPart={viewerDocPart} onClose={() => setViewerDocPart(null)} />
    )}

    {/* Image Viewer Modal */}
    {!!viewerImageRefPart && (
      <ViewImageRefPartModal imageRefPart={viewerImageRefPart} onClose={() => setViewerImageRefPart(null)} />
    )}

    {/* Single LLM Attachment Draft Menu */}
    {!!itemMenuAnchor && !!itemMenuLLMDraft && (
      <LLMAttachmentMenu
        attachmentDraftsStoreApi={props.attachmentDraftsStoreApi}
        llmAttachmentDraft={itemMenuLLMDraft}
        menuAnchor={itemMenuAnchor}
        isPositionFirst={itemMenuIndex === 0}
        isPositionLast={itemMenuIndex === llmAttachmentDrafts.length - 1}
        onClose={handleDraftMenuHide}
        onViewDocPart={handleViewDocPart}
        onViewImageRefPart={handleViewImageRefPart}
      />
    )}

  </>;
}
