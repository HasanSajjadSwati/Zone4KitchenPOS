import React, { useState } from 'react';
import { useDialogStore } from '@/stores/dialogStore';
import { Modal, Button, Input } from '@/components/ui';
import {
  ExclamationTriangleIcon,
  InformationCircleIcon,
  CheckCircleIcon
} from '@heroicons/react/24/outline';

export const DialogProvider: React.FC = () => {
  const { dialog, isOpen, close } = useDialogStore();
  const [promptValue, setPromptValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleClose = () => {
    setPromptValue('');
    setIsLoading(false);
    close();
  };

  const handleConfirm = async () => {
    if (!dialog) return;

    if (dialog.type === 'confirm') {
      setIsLoading(true);
      try {
        await dialog.onConfirm();
        handleClose();
      } catch (error) {
        setIsLoading(false);
      }
    } else if (dialog.type === 'prompt') {
      setIsLoading(true);
      try {
        await dialog.onConfirm(promptValue);
        handleClose();
      } catch (error) {
        setIsLoading(false);
      }
    }
  };

  const handleCancel = () => {
    if (dialog && dialog.type !== 'alert') {
      dialog.onCancel?.();
    }
    handleClose();
  };

  if (!dialog) return null;

  const getIcon = () => {
    if (dialog.type === 'alert') {
      return <CheckCircleIcon className="w-12 h-12 text-green-500 mx-auto mb-4" />;
    }
    if (dialog.type === 'confirm') {
      const variant = dialog.variant || 'primary';
      if (variant === 'danger') {
        return <ExclamationTriangleIcon className="w-12 h-12 text-red-500 mx-auto mb-4" />;
      }
      if (variant === 'warning') {
        return <ExclamationTriangleIcon className="w-12 h-12 text-yellow-500 mx-auto mb-4" />;
      }
      return <InformationCircleIcon className="w-12 h-12 text-blue-500 mx-auto mb-4" />;
    }
    return <InformationCircleIcon className="w-12 h-12 text-blue-500 mx-auto mb-4" />;
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={dialog.type === 'alert' ? handleClose : handleCancel}
      title={dialog.title || (dialog.type === 'alert' ? 'Notice' : dialog.type === 'confirm' ? 'Confirm' : 'Input Required')}
      size="sm"
    >
      <div className="text-center">
        {getIcon()}
        <p className="text-gray-700 mb-6 whitespace-pre-line">{dialog.message}</p>

        {dialog.type === 'prompt' && (
          <Input
            placeholder={dialog.placeholder}
            value={promptValue}
            onChange={(e) => setPromptValue(e.target.value)}
            autoFocus
          />
        )}

        <div className="flex justify-center space-x-3 mt-6">
          {dialog.type === 'alert' ? (
            <Button onClick={handleClose} variant="primary" fullWidth>
              OK
            </Button>
          ) : (
            <>
              <Button onClick={handleCancel} variant="secondary">
                {dialog.cancelLabel || 'Cancel'}
              </Button>
              <Button
                onClick={handleConfirm}
                variant={dialog.type === 'confirm' ? (dialog.variant || 'primary') : 'primary'}
                isLoading={isLoading}
              >
                {dialog.confirmLabel || 'Confirm'}
              </Button>
            </>
          )}
        </div>
      </div>
    </Modal>
  );
};
