import { create } from 'zustand';

export interface AlertDialog {
  type: 'alert';
  title?: string;
  message: string;
  onClose?: () => void;
}

export interface ConfirmDialog {
  type: 'confirm';
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'primary' | 'danger' | 'warning';
  onConfirm: () => void | Promise<void>;
  onCancel?: () => void;
}

export interface PromptDialog {
  type: 'prompt';
  title?: string;
  message: string;
  placeholder?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: (value: string) => void | Promise<void>;
  onCancel?: () => void;
}

export type Dialog = AlertDialog | ConfirmDialog | PromptDialog;

interface DialogState {
  dialog: Dialog | null;
  isOpen: boolean;
  showAlert: (message: string, title?: string) => void;
  showConfirm: (params: {
    message: string;
    title?: string;
    confirmLabel?: string;
    cancelLabel?: string;
    variant?: 'primary' | 'danger' | 'warning';
    onConfirm: () => void | Promise<void>;
    onCancel?: () => void;
  }) => void;
  showPrompt: (params: {
    message: string;
    title?: string;
    placeholder?: string;
    confirmLabel?: string;
    cancelLabel?: string;
    onConfirm: (value: string) => void | Promise<void>;
    onCancel?: () => void;
  }) => void;
  close: () => void;
}

export const useDialogStore = create<DialogState>((set) => ({
  dialog: null,
  isOpen: false,
  showAlert: (message: string, title?: string) => {
    set({
      dialog: { type: 'alert', message, title },
      isOpen: true,
    });
  },
  showConfirm: (params) => {
    set({
      dialog: {
        type: 'confirm',
        message: params.message,
        title: params.title,
        confirmLabel: params.confirmLabel,
        cancelLabel: params.cancelLabel,
        variant: params.variant,
        onConfirm: params.onConfirm,
        onCancel: params.onCancel,
      },
      isOpen: true,
    });
  },
  showPrompt: (params) => {
    set({
      dialog: {
        type: 'prompt',
        message: params.message,
        title: params.title,
        placeholder: params.placeholder,
        confirmLabel: params.confirmLabel,
        cancelLabel: params.cancelLabel,
        onConfirm: params.onConfirm,
        onCancel: params.onCancel,
      },
      isOpen: true,
    });
  },
  close: () => {
    set({ dialog: null, isOpen: false });
  },
}));
