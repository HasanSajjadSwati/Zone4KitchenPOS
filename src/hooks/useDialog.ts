import { useDialogStore } from '@/stores/dialogStore';

export const useDialog = () => {
  const { showAlert, showConfirm, showPrompt } = useDialogStore();

  return {
    alert: (message: string, title?: string) => {
      return new Promise<void>((resolve) => {
        showAlert(message, title);
        // Resolve after a short delay to allow the modal to close
        setTimeout(resolve, 100);
      });
    },
    confirm: (params: {
      message: string;
      title?: string;
      confirmLabel?: string;
      cancelLabel?: string;
      variant?: 'primary' | 'danger' | 'warning';
    }) => {
      return new Promise<boolean>((resolve) => {
        showConfirm({
          ...params,
          onConfirm: () => resolve(true),
          onCancel: () => resolve(false),
        });
      });
    },
    prompt: (params: {
      message: string;
      title?: string;
      placeholder?: string;
      confirmLabel?: string;
      cancelLabel?: string;
    }) => {
      return new Promise<string | null>((resolve) => {
        showPrompt({
          ...params,
          onConfirm: (value) => resolve(value),
          onCancel: () => resolve(null),
        });
      });
    },
  };
};
