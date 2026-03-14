'use client';

import Link from 'next/link';
import { FormEvent, MouseEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';

import type {
  ApiError,
  Document,
  DocumentAccessRole,
  DocumentActivity,
  DocumentAnnotation,
  DocumentAnnotationType,
  DocumentComment,
  DocumentFile,
  DocumentShare,
  DocumentStatus
} from '@kami/shared';

import { tryCreateSupabaseBrowserClient } from '@/lib/supabase/browser';
import { showToast } from '@/lib/toast';

type DocumentForm = {
  title: string;
  content: string;
  status: DocumentStatus;
};

type ShareForm = {
  email: string;
  role: 'viewer' | 'editor';
};

type SharesResponse = {
  items: DocumentShare[];
};

type ActivityResponse = {
  items: DocumentActivity[];
};

type FilesResponse = {
  items: DocumentFile[];
};

type AnnotationsResponse = {
  items: DocumentAnnotation[];
};

type CommentsResponse = {
  items: DocumentComment[];
};

type AnnotationForm = {
  type: DocumentAnnotationType;
  content: string;
  color: string;
  anchorLabel: string;
};

type SelectionState = {
  text: string;
  anchorLabel: string;
};

type CommentForm = {
  body: string;
  mentionEmailsText: string;
  parentCommentId: string | null;
};

const initialForm: DocumentForm = {
  title: '',
  content: '',
  status: 'draft'
};

const initialShareForm: ShareForm = {
  email: '',
  role: 'viewer'
};

const initialAnnotationForm: AnnotationForm = {
  type: 'highlight',
  content: '',
  color: '#ffe58f',
  anchorLabel: ''
};

const initialCommentForm: CommentForm = {
  body: '',
  mentionEmailsText: '',
  parentCommentId: null
};

function getAccessRole(document: Document | null): DocumentAccessRole {
  return document?.accessRole ?? 'owner';
}

export default function DocumentDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const documentId = params.id;

  const [documentData, setDocumentData] = useState<Document | null>(null);
  const [form, setForm] = useState<DocumentForm>(initialForm);
  const [shareForm, setShareForm] = useState<ShareForm>(initialShareForm);
  const [shares, setShares] = useState<DocumentShare[]>([]);
  const [activities, setActivities] = useState<DocumentActivity[]>([]);
  const [files, setFiles] = useState<DocumentFile[]>([]);
  const [annotations, setAnnotations] = useState<DocumentAnnotation[]>([]);
  const [comments, setComments] = useState<DocumentComment[]>([]);
  const [filesLoading, setFilesLoading] = useState(false);
  const [annotationsLoading, setAnnotationsLoading] = useState(false);
  const [fileUploading, setFileUploading] = useState(false);
  const [annotationSaving, setAnnotationSaving] = useState(false);
  const [commentSaving, setCommentSaving] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewFile, setPreviewFile] = useState<DocumentFile | null>(null);
  const [annotationForm, setAnnotationForm] = useState<AnnotationForm>(initialAnnotationForm);
  const [commentForm, setCommentForm] = useState<CommentForm>(initialCommentForm);
  const [selectionState, setSelectionState] = useState<SelectionState | null>(null);
  const [annotationFilter, setAnnotationFilter] = useState<'all' | DocumentAnnotationType>('all');
  const previewRef = useRef<HTMLDivElement | null>(null);
  const [loading, setLoading] = useState(true);
  const [sharesLoading, setSharesLoading] = useState(false);
  const [activityLoading, setActivityLoading] = useState(false);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [shareSaving, setShareSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [liveMessage, setLiveMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [authLoading, setAuthLoading] = useState(true);
  const [accessToken, setAccessToken] = useState<string | null>(null);

  const accessRole = getAccessRole(documentData);
  const canEdit = accessRole === 'owner' || accessRole === 'editor';
  const canDelete = accessRole === 'owner';
  const canShare = accessRole === 'owner';
  const filteredAnnotations = useMemo(() => {
    if (annotationFilter === 'all') {
      return annotations;
    }

    return annotations.filter((item) => item.type === annotationFilter);
  }, [annotationFilter, annotations]);
  const rootComments = useMemo(
    () => comments.filter((item) => !item.parentCommentId),
    [comments]
  );
  const repliesByParent = useMemo(() => {
    const map = new Map<string, DocumentComment[]>();
    for (const item of comments) {
      if (!item.parentCommentId) {
        continue;
      }
      const list = map.get(item.parentCommentId) ?? [];
      list.push(item);
      map.set(item.parentCommentId, list);
    }
    return map;
  }, [comments]);

  useEffect(() => {
    const supabase = tryCreateSupabaseBrowserClient();

    if (!supabase) {
      setErrorMessage('Missing Supabase public environment variables.');
      setAuthLoading(false);
      return;
    }

    supabase.auth
      .getSession()
      .then(({ data }) => {
        const token = data.session?.access_token ?? null;
        setAccessToken(token);
        setAuthLoading(false);

        if (!token) {
          router.replace('/auth');
        }
      })
      .catch(() => {
        setErrorMessage('Unable to connect to Supabase session service.');
        setAuthLoading(false);
      });

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const token = session?.access_token ?? null;
      setAccessToken(token);

      if (!token) {
        router.replace('/auth');
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [router]);

  const authedFetch = useCallback(
    async (input: string, init?: RequestInit) => {
      if (!accessToken) {
        throw new Error('Authentication required');
      }

      const headers = new Headers(init?.headers);
      headers.set('Authorization', `Bearer ${accessToken}`);

      return fetch(input, {
        ...init,
        headers
      });
    },
    [accessToken]
  );

  const loadShares = useCallback(async () => {
    if (!accessToken || !documentId) {
      return;
    }

    setSharesLoading(true);

    try {
      const response = await authedFetch(`/api/documents/${documentId}/shares`, { cache: 'no-store' });

      if (!response.ok) {
        throw new Error('Unable to load collaborators');
      }

      const payload = (await response.json()) as SharesResponse;
      setShares(payload.items ?? []);
    } catch {
      setShares([]);
    } finally {
      setSharesLoading(false);
    }
  }, [accessToken, authedFetch, documentId]);

  const loadActivity = useCallback(async () => {
    if (!accessToken || !documentId) {
      return;
    }

    setActivityLoading(true);

    try {
      const response = await authedFetch(`/api/documents/${documentId}/activity`, {
        cache: 'no-store'
      });

      if (!response.ok) {
        throw new Error('Unable to load activity');
      }

      const payload = (await response.json()) as ActivityResponse;
      setActivities(payload.items ?? []);
    } catch {
      setActivities([]);
    } finally {
      setActivityLoading(false);
    }
  }, [accessToken, authedFetch, documentId]);

  const loadFiles = useCallback(async () => {
    if (!accessToken || !documentId) {
      return;
    }

    setFilesLoading(true);

    try {
      const response = await authedFetch(`/api/documents/${documentId}/files`, {
        cache: 'no-store'
      });

      if (!response.ok) {
        throw new Error('Unable to load files');
      }

      const payload = (await response.json()) as FilesResponse;
      setFiles(payload.items ?? []);
      setPreviewFile((prev) => {
        if (!prev) {
          return null;
        }
        return (payload.items ?? []).find((item) => item.id === prev.id) ?? null;
      });
    } catch {
      setFiles([]);
    } finally {
      setFilesLoading(false);
    }
  }, [accessToken, authedFetch, documentId]);

  const loadAnnotations = useCallback(async () => {
    if (!accessToken || !documentId) {
      return;
    }

    setAnnotationsLoading(true);

    try {
      const response = await authedFetch(`/api/documents/${documentId}/annotations`, {
        cache: 'no-store'
      });

      if (!response.ok) {
        throw new Error('Unable to load annotations');
      }

      const payload = (await response.json()) as AnnotationsResponse;
      setAnnotations(payload.items ?? []);
    } catch {
      setAnnotations([]);
    } finally {
      setAnnotationsLoading(false);
    }
  }, [accessToken, authedFetch, documentId]);

  const loadComments = useCallback(async () => {
    if (!accessToken || !documentId) {
      return;
    }

    setCommentsLoading(true);
    try {
      const response = await authedFetch(`/api/documents/${documentId}/comments`, {
        cache: 'no-store'
      });

      if (!response.ok) {
        throw new Error('Unable to load comments');
      }

      const payload = (await response.json()) as CommentsResponse;
      setComments(payload.items ?? []);
    } catch {
      setComments([]);
    } finally {
      setCommentsLoading(false);
    }
  }, [accessToken, authedFetch, documentId]);

  const loadDocument = useCallback(async () => {
    if (!accessToken || !documentId) {
      return;
    }

    setLoading(true);
    setErrorMessage('');

    try {
      const response = await authedFetch(`/api/documents/${documentId}`, { cache: 'no-store' });

      if (!response.ok) {
        const error = (await response.json()) as ApiError;
        throw new Error(error.message || 'Unable to load document');
      }

      const document = (await response.json()) as Document;
      setDocumentData(document);
      setForm({
        title: document.title,
        content: document.content,
        status: document.status
      });

      if ((document.accessRole ?? 'owner') === 'owner') {
        await loadShares();
      } else {
        setShares([]);
      }

      await loadFiles();
      await loadAnnotations();
      await loadComments();
      await loadActivity();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to load document');
    } finally {
      setLoading(false);
    }
  }, [accessToken, authedFetch, documentId, loadActivity, loadAnnotations, loadComments, loadFiles, loadShares]);

  useEffect(() => {
    if (accessToken && documentId) {
      void loadDocument();
    }
  }, [accessToken, documentId, loadDocument]);

  useEffect(() => {
    if (!accessToken || !documentId) {
      return;
    }

    const supabase = tryCreateSupabaseBrowserClient();
    if (!supabase) {
      return;
    }

    const channel = supabase.channel(`document-live-${documentId}`);

    channel
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'documents',
          filter: `id=eq.${documentId}`
        },
        () => {
          setLiveMessage('Live update: document content changed.');
          void loadDocument();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'document_annotations',
          filter: `document_id=eq.${documentId}`
        },
        () => {
          setLiveMessage('Live update: annotations changed.');
          void loadAnnotations();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'document_activity',
          filter: `document_id=eq.${documentId}`
        },
        () => {
          void loadActivity();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'document_comments',
          filter: `document_id=eq.${documentId}`
        },
        () => {
          setLiveMessage('Live update: comments changed.');
          void loadComments();
          void loadActivity();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [accessToken, documentId, loadActivity, loadAnnotations, loadComments, loadDocument]);

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canEdit) {
      setErrorMessage('You only have view access for this document.');
      return;
    }

    setSaving(true);
    setMessage('');
    setErrorMessage('');

    try {
      const response = await authedFetch(`/api/documents/${documentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });

      if (!response.ok) {
        const error = (await response.json()) as ApiError;
        throw new Error(error.message || 'Unable to save document');
      }

      const updated = (await response.json()) as Document;
      setDocumentData(updated);
      setMessage('Document saved successfully.');
      await loadActivity();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to save document');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!canDelete) {
      setErrorMessage('Only owners can delete documents.');
      showToast('warning', 'Only owners can delete documents.');
      return;
    }

    const confirmed = window.confirm(
      'Delete this document permanently? This action cannot be undone.'
    );
    if (!confirmed) {
      showToast('warning', 'Document deletion cancelled.');
      return;
    }

    setMessage('');
    setErrorMessage('');

    try {
      const response = await authedFetch(`/api/documents/${documentId}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        const error = (await response.json()) as ApiError;
        throw new Error(error.message || 'Unable to delete document');
      }

      showToast('success', 'Document deleted successfully.');
      router.push('/documents');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to delete document';
      setErrorMessage(message);
      showToast('error', message);
    }
  }

  async function handleAddShare(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canShare) {
      setErrorMessage('Only owners can manage collaborators.');
      return;
    }

    setShareSaving(true);
    setMessage('');
    setErrorMessage('');

    try {
      const response = await authedFetch(`/api/documents/${documentId}/shares`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(shareForm)
      });

      if (!response.ok) {
        const error = (await response.json()) as ApiError;
        throw new Error(error.message || 'Unable to add collaborator');
      }

      setShareForm(initialShareForm);
      setMessage('Collaborator saved.');
      await loadShares();
      await loadActivity();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to add collaborator');
    } finally {
      setShareSaving(false);
    }
  }

  async function handleRemoveShare(userId: string) {
    if (!canShare) {
      setErrorMessage('Only owners can manage collaborators.');
      showToast('warning', 'Only owners can manage collaborators.');
      return;
    }

    const confirmed = window.confirm('Remove this collaborator from the document?');
    if (!confirmed) {
      showToast('warning', 'Collaborator removal cancelled.');
      return;
    }

    setMessage('');
    setErrorMessage('');

    try {
      const response = await authedFetch(`/api/documents/${documentId}/shares/${userId}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        const error = (await response.json()) as ApiError;
        throw new Error(error.message || 'Unable to remove collaborator');
      }

      setMessage('Collaborator removed.');
      showToast('success', 'Collaborator removed successfully.');
      await loadShares();
      await loadActivity();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to remove collaborator';
      setErrorMessage(message);
      showToast('error', message);
    }
  }

  async function handleUploadFile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canEdit) {
      setErrorMessage('You do not have permission to upload files.');
      return;
    }

    if (!selectedFile) {
      setErrorMessage('Select a file to upload.');
      return;
    }

    setFileUploading(true);
    setMessage('');
    setErrorMessage('');

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      const response = await authedFetch(`/api/documents/${documentId}/files`, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        const error = (await response.json()) as ApiError;
        throw new Error(error.message || 'Unable to upload file');
      }

      setSelectedFile(null);
      setMessage('File uploaded successfully.');
      await loadFiles();
      await loadActivity();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to upload file');
    } finally {
      setFileUploading(false);
    }
  }

  async function handleAddAnnotation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canEdit) {
      setErrorMessage('You do not have permission to add annotations.');
      return;
    }

    setAnnotationSaving(true);
    setMessage('');
    setErrorMessage('');

    try {
      const response = await authedFetch(`/api/documents/${documentId}/annotations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: annotationForm.type,
          content: annotationForm.content.trim(),
          color: annotationForm.color,
          anchor: {
            label: annotationForm.anchorLabel.trim(),
            ...(selectionState ? { selectedText: selectionState.text } : {})
          }
        })
      });

      if (!response.ok) {
        const error = (await response.json()) as ApiError;
        throw new Error(error.message || 'Unable to add annotation');
      }

      setAnnotationForm(initialAnnotationForm);
      setMessage('Annotation added.');
      await loadAnnotations();
      await loadActivity();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to add annotation');
    } finally {
      setAnnotationSaving(false);
    }
  }

  async function handleUpdateAnnotation(annotation: DocumentAnnotation) {
    if (!canEdit) {
      setErrorMessage('You do not have permission to edit annotations.');
      return;
    }

    const nextContent = window.prompt('Update annotation content', annotation.content ?? '');
    if (nextContent === null) {
      return;
    }

    try {
      const response = await authedFetch(
        `/api/documents/${documentId}/annotations/${annotation.id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: nextContent })
        }
      );

      if (!response.ok) {
        const error = (await response.json()) as ApiError;
        throw new Error(error.message || 'Unable to update annotation');
      }

      setMessage('Annotation updated.');
      await loadAnnotations();
      await loadActivity();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to update annotation');
    }
  }

  async function handleDeleteAnnotation(annotationId: string) {
    if (!canEdit) {
      setErrorMessage('You do not have permission to delete annotations.');
      showToast('warning', 'You do not have permission to delete annotations.');
      return;
    }

    const confirmed = window.confirm('Delete this annotation?');
    if (!confirmed) {
      showToast('warning', 'Annotation deletion cancelled.');
      return;
    }

    try {
      const response = await authedFetch(
        `/api/documents/${documentId}/annotations/${annotationId}`,
        { method: 'DELETE' }
      );

      if (!response.ok) {
        const error = (await response.json()) as ApiError;
        throw new Error(error.message || 'Unable to delete annotation');
      }

      setMessage('Annotation deleted.');
      showToast('success', 'Annotation deleted successfully.');
      await loadAnnotations();
      await loadActivity();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to delete annotation';
      setErrorMessage(message);
      showToast('error', message);
    }
  }

  async function handleAddComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!commentForm.body.trim()) {
      setErrorMessage('Comment text is required.');
      return;
    }

    setCommentSaving(true);
    setMessage('');
    setErrorMessage('');

    const mentionEmails = commentForm.mentionEmailsText
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);

    try {
      const response = await authedFetch(`/api/documents/${documentId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          body: commentForm.body.trim(),
          parentCommentId: commentForm.parentCommentId,
          mentionEmails
        })
      });

      if (!response.ok) {
        const error = (await response.json()) as ApiError;
        throw new Error(error.message || 'Unable to add comment');
      }

      setCommentForm(initialCommentForm);
      setMessage('Comment added.');
      await loadComments();
      await loadActivity();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to add comment');
    } finally {
      setCommentSaving(false);
    }
  }

  async function handleEditComment(comment: DocumentComment) {
    const next = window.prompt('Update comment', comment.body);
    if (next === null) {
      return;
    }

    try {
      const response = await authedFetch(`/api/documents/${documentId}/comments/${comment.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: next })
      });

      if (!response.ok) {
        const error = (await response.json()) as ApiError;
        throw new Error(error.message || 'Unable to update comment');
      }

      setMessage('Comment updated.');
      await loadComments();
      await loadActivity();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to update comment');
    }
  }

  async function handleDeleteComment(commentId: string) {
    const confirmed = window.confirm('Delete this comment?');
    if (!confirmed) {
      showToast('warning', 'Comment deletion cancelled.');
      return;
    }

    try {
      const response = await authedFetch(`/api/documents/${documentId}/comments/${commentId}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        const error = (await response.json()) as ApiError;
        throw new Error(error.message || 'Unable to delete comment');
      }

      setMessage('Comment deleted.');
      showToast('success', 'Comment deleted successfully.');
      await loadComments();
      await loadActivity();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to delete comment';
      setErrorMessage(message);
      showToast('error', message);
    }
  }

  function startReply(parentCommentId: string) {
    setCommentForm((prev) => ({
      ...prev,
      parentCommentId
    }));
  }

  function handlePreviewSelection(event: MouseEvent<HTMLDivElement>) {
    void event;
    if (!previewRef.current) {
      return;
    }

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      return;
    }

    const text = selection.toString().trim();
    if (!text) {
      setSelectionState(null);
      return;
    }

    const range = selection.getRangeAt(0);
    const withinPreview = previewRef.current.contains(range.commonAncestorContainer);
    if (!withinPreview) {
      return;
    }

    const anchorLabel = `Selected ${Math.min(text.length, 120)} chars`;
    setSelectionState({
      text: text.slice(0, 500),
      anchorLabel
    });
    setAnnotationForm((prev) => ({
      ...prev,
      content: text.slice(0, 500),
      anchorLabel
    }));
  }

  async function quickAddFromSelection(type: DocumentAnnotationType) {
    if (!canEdit) {
      setErrorMessage('You do not have permission to add annotations.');
      return;
    }

    if (!selectionState) {
      setErrorMessage('Select text from the preview first.');
      return;
    }

    setAnnotationSaving(true);
    setMessage('');
    setErrorMessage('');

    try {
      const response = await authedFetch(`/api/documents/${documentId}/annotations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          content: selectionState.text,
          color: annotationForm.color,
          anchor: {
            label: selectionState.anchorLabel,
            selectedText: selectionState.text
          }
        })
      });

      if (!response.ok) {
        const error = (await response.json()) as ApiError;
        throw new Error(error.message || 'Unable to add annotation');
      }

      setSelectionState(null);
      setAnnotationForm((prev) => ({ ...prev, content: '', anchorLabel: '' }));
      setMessage('Annotation added from selected text.');
      await loadAnnotations();
      await loadActivity();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to add annotation');
    } finally {
      setAnnotationSaving(false);
    }
  }

  async function handleExportDocument() {
    if (!documentId) {
      return;
    }

    setErrorMessage('');
    setMessage('');

    try {
      const response = await authedFetch(`/api/documents/${documentId}/export`, {
        method: 'GET'
      });

      if (!response.ok) {
        const error = (await response.json()) as ApiError;
        throw new Error(error.message || 'Unable to export document');
      }

      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = blobUrl;
      anchor.download = `${form.title || 'document'}.txt`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(blobUrl);

      setMessage('Document export started.');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to export document');
    }
  }

  if (authLoading) {
    return (
      <main className="page">
        <section className="card">
          <p>Checking session...</p>
        </section>
      </main>
    );
  }

  return (
    <main className="page">
      <section className="hero card">
        <p className="kicker">Document Detail</p>
        <h1>Document Editor</h1>
        <p className="subtitle">Edit full content and publication status.</p>
        <p className="meta">
          Access role: <span className="rolePill">{accessRole}</span>
        </p>
        <div className="heroActions">
          <Link className="buttonLink secondary" href="/documents">
            Back to Documents
          </Link>
        </div>
      </section>

      <section className="card">
        {loading ? (
          <p>Loading document...</p>
        ) : (
          <form className="form" onSubmit={handleSave}>
            <label>
              Title
              <input
                value={form.title}
                onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
                minLength={2}
                maxLength={120}
                required
                disabled={!canEdit}
              />
            </label>

            <label>
              Content
              <textarea
                rows={12}
                value={form.content}
                onChange={(event) => setForm((prev) => ({ ...prev, content: event.target.value }))}
                maxLength={10000}
                required
                disabled={!canEdit}
              />
            </label>

            <label>
              Status
              <select
                value={form.status}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, status: event.target.value as DocumentStatus }))
                }
                disabled={!canEdit}
              >
                <option value="draft">Draft</option>
                <option value="published">Published</option>
              </select>
            </label>

            <div className="inlineActions">
              {canEdit ? (
                <button type="submit" disabled={saving}>
                  {saving ? 'Saving...' : 'Save'}
                </button>
              ) : null}
              <button type="button" className="secondaryButton" onClick={() => void handleExportDocument()}>
                Export (.txt)
              </button>
              {canDelete ? (
                <button type="button" className="dangerButton" onClick={() => void handleDelete()}>
                  Delete
                </button>
              ) : null}
            </div>
          </form>
        )}

        {message ? <p className="success">{message}</p> : null}
        {liveMessage ? <p className="meta">{liveMessage}</p> : null}
        {errorMessage ? <p className="error">{errorMessage}</p> : null}
      </section>

      <section className="card">
        <h2>Reading Preview</h2>
        <p className="meta">
          Select text below, then use quick actions to create highlight, note, or text annotations.
        </p>
        <div
          ref={previewRef}
          onMouseUp={handlePreviewSelection}
          style={{
            border: '1px solid var(--line)',
            borderRadius: '12px',
            padding: '14px',
            background: 'var(--surface-strong)',
            minHeight: '120px',
            whiteSpace: 'pre-wrap'
          }}
        >
          {form.content || 'No content available for preview.'}
        </div>

        <div className="inlineActions" style={{ marginTop: '10px' }}>
          <label className="meta" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
            Annotation color
            <input
              type="color"
              value={annotationForm.color}
              onChange={(event) =>
                setAnnotationForm((prev) => ({ ...prev, color: event.target.value }))
              }
            />
          </label>
          <button type="button" onClick={() => void quickAddFromSelection('highlight')} disabled={annotationSaving}>
            Quick Highlight
          </button>
          <button type="button" onClick={() => void quickAddFromSelection('note')} disabled={annotationSaving}>
            Quick Note
          </button>
          <button type="button" onClick={() => void quickAddFromSelection('text')} disabled={annotationSaving}>
            Quick Text
          </button>
        </div>

        {selectionState ? (
          <p className="meta">Selected: &quot;{selectionState.text.slice(0, 140)}&quot;</p>
        ) : (
          <p className="meta">No text selected.</p>
        )}
      </section>

      {canShare ? (
        <section className="card">
          <h2>Collaborators</h2>
          <p className="meta">Add a collaborator email and assign access role.</p>

          <form className="form" onSubmit={handleAddShare}>
            <label>
              Collaborator Email
              <input
                value={shareForm.email}
                onChange={(event) =>
                  setShareForm((prev) => ({ ...prev, email: event.target.value.trim() }))
                }
                placeholder="Collaborator Email"
                required
                type="email"
              />
            </label>

            <label>
              Role
              <select
                value={shareForm.role}
                onChange={(event) =>
                  setShareForm((prev) => ({ ...prev, role: event.target.value as ShareForm['role'] }))
                }
              >
                <option value="viewer">Viewer</option>
                <option value="editor">Editor</option>
              </select>
            </label>

            <button type="submit" disabled={shareSaving}>
              {shareSaving ? 'Saving...' : 'Add or update collaborator'}
            </button>
          </form>

          {sharesLoading ? <p>Loading collaborators...</p> : null}
          {!sharesLoading && shares.length === 0 ? <p className="meta">No collaborators added.</p> : null}

          {!sharesLoading && shares.length > 0 ? (
            <ul>
              {shares.map((share) => (
                <li key={share.userId}>
                  <p className="meta">Email: {share.email ?? 'Unknown'}</p>
                  <p className="meta">User ID: {share.userId}</p>
                  <p className="meta">
                    Role: <span className="rolePill">{share.role}</span>
                  </p>
                  <p className="meta">Added: {new Date(share.createdAt).toLocaleString()}</p>
                  <div className="inlineActions">
                    <button
                      type="button"
                      className="dangerButton"
                      onClick={() => void handleRemoveShare(share.userId)}
                    >
                      Remove
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}

      <section className="card">
        <h2>Files</h2>
        <p className="meta">Upload PDF, Office files, images, or text files (max 10 MB).</p>

        {canEdit ? (
          <form className="form" onSubmit={handleUploadFile}>
            <label>
              Select File
              <input
                type="file"
                onChange={(event) => {
                  const nextFile = event.target.files?.[0] ?? null;
                  setSelectedFile(nextFile);
                }}
                accept=".pdf,.doc,.docx,.ppt,.pptx,.png,.jpg,.jpeg,.webp,.txt"
              />
            </label>
            <button type="submit" disabled={fileUploading}>
              {fileUploading ? 'Uploading...' : 'Upload file'}
            </button>
          </form>
        ) : null}

        {filesLoading ? <p>Loading files...</p> : null}
        {!filesLoading && files.length === 0 ? <p className="meta">No files uploaded yet.</p> : null}

        {!filesLoading && files.length > 0 ? (
          <ul>
            {files.map((file) => (
              <li key={file.id}>
                <p className="meta">Name: {file.fileName}</p>
                <p className="meta">Type: {file.mimeType}</p>
                <p className="meta">Size: {Math.ceil(file.sizeBytes / 1024)} KB</p>
                <p className="meta">Uploaded: {new Date(file.createdAt).toLocaleString()}</p>
                {file.signedUrl ? (
                  <div className="inlineActions">
                    <a href={file.signedUrl} target="_blank" rel="noreferrer">
                      Open file
                    </a>
                    {(file.mimeType === 'application/pdf' || file.mimeType.startsWith('image/')) ? (
                      <button type="button" onClick={() => setPreviewFile(file)}>
                        Preview
                      </button>
                    ) : null}
                  </div>
                ) : (
                  <p className="meta">Signed URL unavailable.</p>
                )}
              </li>
            ))}
          </ul>
        ) : null}

        {previewFile?.signedUrl ? (
          <div>
            <div className="inlineActions">
              <p className="meta">Preview: {previewFile.fileName}</p>
              <button type="button" className="secondaryButton" onClick={() => setPreviewFile(null)}>
                Close preview
              </button>
            </div>

            {previewFile.mimeType === 'application/pdf' ? (
              <iframe
                title={`Preview ${previewFile.fileName}`}
                src={previewFile.signedUrl}
                style={{ width: '100%', height: '520px', border: '1px solid var(--line)', borderRadius: '12px' }}
              />
            ) : previewFile.mimeType.startsWith('image/') ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                alt={previewFile.fileName}
                src={previewFile.signedUrl}
                style={{ width: '100%', maxHeight: '520px', objectFit: 'contain', borderRadius: '12px' }}
              />
            ) : null}
          </div>
        ) : null}
      </section>

      <section className="card">
        <h2>Annotations</h2>
        <p className="meta">Track highlights, notes, and text markers for this document.</p>

        <div className="inlineActions">
          <label>
            Filter
            <select
              value={annotationFilter}
              onChange={(event) =>
                setAnnotationFilter(event.target.value as 'all' | DocumentAnnotationType)
              }
            >
              <option value="all">All</option>
              <option value="highlight">Highlight</option>
              <option value="note">Note</option>
              <option value="text">Text</option>
              <option value="drawing">Drawing</option>
            </select>
          </label>
        </div>

        {canEdit ? (
          <form className="form" onSubmit={handleAddAnnotation}>
            <label>
              Type
              <select
                value={annotationForm.type}
                onChange={(event) =>
                  setAnnotationForm((prev) => ({
                    ...prev,
                    type: event.target.value as DocumentAnnotationType
                  }))
                }
              >
                <option value="highlight">Highlight</option>
                <option value="note">Note</option>
                <option value="text">Text</option>
                <option value="drawing">Drawing</option>
              </select>
            </label>

            <label>
              Color
              <input
                type="color"
                value={annotationForm.color}
                onChange={(event) =>
                  setAnnotationForm((prev) => ({ ...prev, color: event.target.value }))
                }
              />
            </label>

            <label>
              Anchor Label
              <input
                value={annotationForm.anchorLabel}
                onChange={(event) =>
                  setAnnotationForm((prev) => ({ ...prev, anchorLabel: event.target.value }))
                }
                placeholder="Anchor Label"
              />
            </label>

            <label>
              Content
              <textarea
                rows={3}
                value={annotationForm.content}
                onChange={(event) =>
                  setAnnotationForm((prev) => ({ ...prev, content: event.target.value }))
                }
                maxLength={5000}
              />
            </label>

            <button type="submit" disabled={annotationSaving}>
              {annotationSaving ? 'Saving...' : 'Add annotation'}
            </button>
          </form>
        ) : null}

        {annotationsLoading ? <p>Loading annotations...</p> : null}
        {!annotationsLoading && filteredAnnotations.length === 0 ? (
          <p className="meta">No annotations yet.</p>
        ) : null}

        {!annotationsLoading && filteredAnnotations.length > 0 ? (
          <ul>
            {filteredAnnotations.map((annotation) => (
              <li key={annotation.id}>
                <p className="meta">
                  Type: <span className="rolePill">{annotation.type}</span>
                </p>
                <p className="meta">
                  Color: <span style={{ color: annotation.color }}>{annotation.color}</span>
                </p>
                <p className="meta">
                  Anchor: {(annotation.anchor?.label as string | undefined) ?? 'Not set'}
                </p>
                <p className="meta">Content: {annotation.content || 'No content'}</p>
                <p className="meta">At: {new Date(annotation.createdAt).toLocaleString()}</p>
                {canEdit ? (
                  <div className="inlineActions">
                    <button type="button" onClick={() => void handleUpdateAnnotation(annotation)}>
                      Edit
                    </button>
                    <button
                      type="button"
                      className="dangerButton"
                      onClick={() => void handleDeleteAnnotation(annotation.id)}
                    >
                      Delete
                    </button>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <section className="card">
        <h2>Comments</h2>
        <p className="meta">Threaded discussion with optional mentions (comma-separated emails).</p>

        <form className="form" onSubmit={handleAddComment}>
          <label>
            Comment
            <textarea
              rows={3}
              value={commentForm.body}
              onChange={(event) =>
                setCommentForm((prev) => ({ ...prev, body: event.target.value }))
              }
              maxLength={2000}
              required
            />
          </label>

          <label>
            Mention Emails
            <input
              value={commentForm.mentionEmailsText}
              onChange={(event) =>
                setCommentForm((prev) => ({ ...prev, mentionEmailsText: event.target.value }))
              }
              placeholder="Mention Emails"
            />
          </label>

          {commentForm.parentCommentId ? (
            <p className="meta">
              Replying to comment: {commentForm.parentCommentId}{' '}
              <button
                type="button"
                className="ghostButton"
                onClick={() => setCommentForm((prev) => ({ ...prev, parentCommentId: null }))}
              >
                Cancel reply
              </button>
            </p>
          ) : null}

          <button type="submit" disabled={commentSaving}>
            {commentSaving ? 'Saving...' : 'Post comment'}
          </button>
        </form>

        {commentsLoading ? <p>Loading comments...</p> : null}
        {!commentsLoading && rootComments.length === 0 ? <p className="meta">No comments yet.</p> : null}

        {!commentsLoading && rootComments.length > 0 ? (
          <ul>
            {rootComments.map((comment) => (
              <li key={comment.id}>
                <p className="meta">Author: {comment.authorEmail ?? comment.authorUserId}</p>
                <p>{comment.body}</p>
                <p className="meta">At: {new Date(comment.createdAt).toLocaleString()}</p>
                <p className="meta">Mentions: {comment.mentionUserIds.length || 0}</p>
                <div className="inlineActions">
                  <button type="button" onClick={() => startReply(comment.id)}>
                    Reply
                  </button>
                  <button type="button" onClick={() => void handleEditComment(comment)}>
                    Edit
                  </button>
                  <button
                    type="button"
                    className="dangerButton"
                    onClick={() => void handleDeleteComment(comment.id)}
                  >
                    Delete
                  </button>
                </div>

                {(repliesByParent.get(comment.id) ?? []).length > 0 ? (
                  <ul>
                    {(repliesByParent.get(comment.id) ?? []).map((reply) => (
                      <li key={reply.id}>
                        <p className="meta">Reply by: {reply.authorEmail ?? reply.authorUserId}</p>
                        <p>{reply.body}</p>
                        <p className="meta">At: {new Date(reply.createdAt).toLocaleString()}</p>
                        <div className="inlineActions">
                          <button type="button" onClick={() => void handleEditComment(reply)}>
                            Edit
                          </button>
                          <button
                            type="button"
                            className="dangerButton"
                            onClick={() => void handleDeleteComment(reply.id)}
                          >
                            Delete
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <section className="card">
        <h2>Activity</h2>
        {activityLoading ? <p>Loading activity...</p> : null}
        {!activityLoading && activities.length === 0 ? (
          <p className="meta">No activity yet.</p>
        ) : null}
        {!activityLoading && activities.length > 0 ? (
          <ul>
            {activities.map((activity) => (
              <li key={activity.id}>
                <p className="meta">
                  Action: <span className="rolePill">{activity.action}</span>
                </p>
                <p className="meta">Actor: {activity.actorEmail ?? activity.actorUserId}</p>
                <p className="meta">At: {new Date(activity.createdAt).toLocaleString()}</p>
              </li>
            ))}
          </ul>
        ) : null}
      </section>
    </main>
  );
}
