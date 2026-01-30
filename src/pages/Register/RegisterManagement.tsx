import React, { useEffect, useState } from 'react';
import { BanknotesIcon, ClockIcon, CheckCircleIcon } from '@heroicons/react/24/outline';
import { Button, Card, Modal, Input } from '@/components/ui';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  openRegister,
  closeRegister,
  getCurrentSession,
  getRecentSessions,
  getSessionStats,
} from '@/services/registerService';
import { useAuthStore } from '@/stores/authStore';
import { useDialog } from '@/hooks/useDialog';
import { formatCurrency, formatDateTime } from '@/utils/validation';
import type { RegisterSession } from '@/db/types';

const openRegisterSchema = z.object({
  openingCash: z.number().min(0, 'Opening cash must be positive'),
});

const closeRegisterSchema = z.object({
  closingCash: z.number().min(0, 'Closing cash must be positive'),
  notes: z.string().nullable(),
});

type OpenRegisterFormData = z.infer<typeof openRegisterSchema>;
type CloseRegisterFormData = z.infer<typeof closeRegisterSchema>;

export const RegisterManagement: React.FC = () => {
  const currentUser = useAuthStore((state) => state.currentUser);
  const dialog = useDialog();
  const [currentSession, setCurrentSession] = useState<RegisterSession | null>(null);
  const [sessionStats, setSessionStats] = useState<any>(null);
  const [recentSessions, setRecentSessions] = useState<RegisterSession[]>([]);
  const [isOpenModalOpen, setIsOpenModalOpen] = useState(false);
  const [isCloseModalOpen, setIsCloseModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isDataLoading, setIsDataLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const openForm = useForm<OpenRegisterFormData>({
    resolver: zodResolver(openRegisterSchema),
    defaultValues: { openingCash: 0 },
  });

  const closeForm = useForm<CloseRegisterFormData>({
    resolver: zodResolver(closeRegisterSchema),
    defaultValues: { closingCash: 0, notes: null },
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setError(null);
      setIsDataLoading(true);

      const session = await getCurrentSession();
      setCurrentSession(session || null);

      if (session) {
        const stats = await getSessionStats(session.id);
        setSessionStats(stats);
      }

      const recent = await getRecentSessions(10);
      setRecentSessions(recent);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load register data';
      console.error('LoadData error:', err);
      setError(errorMessage);
      await dialog.alert(errorMessage, 'Error Loading Data');
    } finally {
      setIsDataLoading(false);
    }
  };

  const handleOpenRegister = async (data: OpenRegisterFormData) => {
    if (!currentUser) return;

    setIsLoading(true);
    try {
      await openRegister(data.openingCash, currentUser.id);
      await loadData();
      setIsOpenModalOpen(false);
      openForm.reset({ openingCash: 0 });
    } catch (error) {
      await dialog.alert(error instanceof Error ? error.message : 'Failed to open register', 'Error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCloseRegister = async (data: CloseRegisterFormData) => {
    if (!currentUser) {
      await dialog.alert('User not authenticated', 'Error');
      return;
    }

    if (!currentSession) {
      await dialog.alert('No active register session', 'Error');
      return;
    }

    setIsLoading(true);
    try {
      await closeRegister(
        currentSession.id,
        data.closingCash,
        data.notes || null,
        currentUser.id
      );
      await loadData();
      setIsCloseModalOpen(false);
      closeForm.reset({ closingCash: 0, notes: null });
      await dialog.alert('Register closed successfully', 'Success');
    } catch (error) {
      await dialog.alert(error instanceof Error ? error.message : 'Failed to close register', 'Error');
    } finally {
      setIsLoading(false);
    }
  };

  // Show loading state
  if (isDataLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Card padding="lg">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading register data...</p>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <Card padding="lg" className="bg-red-50 border border-red-200">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <span className="text-red-600 text-xl">⚠️</span>
            </div>
            <div className="ml-3">
              <h3 className="text-red-800 font-medium">Error Loading Data</h3>
              <p className="text-red-700 text-sm mt-1">{error}</p>
              <Button
                onClick={() => loadData()}
                variant="primary"
                size="sm"
                className="mt-3"
              >
                Retry
              </Button>
            </div>
          </div>
        </Card>
      )}

      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Register Management</h1>
        {!currentSession && (
          <Button
            onClick={() => setIsOpenModalOpen(true)}
            leftIcon={<BanknotesIcon className="w-5 h-5" />}
            variant="success"
          >
            Open Register
          </Button>
        )}
      </div>

      {/* Current Session */}
      {currentSession ? (
        <Card padding="lg">
          <div className="flex items-start justify-between mb-6">
            <div>
              <div className="flex items-center space-x-2 mb-2">
                <CheckCircleIcon className="w-6 h-6 text-success-600" />
                <h2 className="text-2xl font-bold text-gray-900">Register Open</h2>
              </div>
              <p className="text-gray-600">
                Opened {formatDateTime(currentSession.openedAt)}
              </p>
            </div>
            <Button
              variant="danger"
              onClick={() => setIsCloseModalOpen(true)}
              leftIcon={<ClockIcon className="w-5 h-5" />}
            >
              Close Register
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-blue-50 p-4 rounded-lg">
              <p className="text-sm text-blue-600 font-medium mb-1">Opening Cash</p>
              <p className="text-2xl font-bold text-blue-900">
                {formatCurrency(currentSession.openingCash)}
              </p>
            </div>

            <div className="bg-green-50 p-4 rounded-lg">
              <p className="text-sm text-green-600 font-medium mb-1">Total Sales</p>
              <p className="text-2xl font-bold text-green-900">
                {formatCurrency(sessionStats?.totalSales || 0)}
              </p>
            </div>

            <div className="bg-purple-50 p-4 rounded-lg">
              <p className="text-sm text-purple-600 font-medium mb-1">Orders</p>
              <p className="text-2xl font-bold text-purple-900">
                {sessionStats?.totalOrders || 0}
              </p>
            </div>

            <div className="bg-yellow-50 p-4 rounded-lg">
              <p className="text-sm text-yellow-600 font-medium mb-1">Open Orders</p>
              <p className="text-2xl font-bold text-yellow-900">
                {sessionStats?.openOrders || 0}
              </p>
            </div>
          </div>

          {sessionStats?.paymentsByMethod && (
            <div>
              <h3 className="font-semibold text-gray-900 mb-3">Payment Breakdown</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {Object.entries(sessionStats.paymentsByMethod).map(([method, amount]) => (
                  <div
                    key={method}
                    className="bg-gray-50 p-3 rounded-lg border border-gray-200"
                  >
                    <p className="text-xs text-gray-600 uppercase mb-1">{method}</p>
                    <p className="text-lg font-bold text-gray-900">
                      {formatCurrency(amount as number)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
      ) : (
        <Card padding="lg">
          <div className="text-center py-12">
            <BanknotesIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              No Active Register Session
            </h3>
            <p className="text-gray-600 mb-6">
              Open a register session to start taking orders
            </p>
            <Button
              onClick={() => setIsOpenModalOpen(true)}
              leftIcon={<BanknotesIcon className="w-5 h-5" />}
              variant="success"
              size="lg"
            >
              Open Register
            </Button>
          </div>
        </Card>
      )}

      {/* Recent Sessions */}
      <div>
        <h2 className="text-xl font-bold text-gray-900 mb-4">Recent Sessions</h2>
        <div className="space-y-3">
          {recentSessions.map((session) => (
            <Card key={session.id} padding="md">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-2">
                    <span
                      className={`px-2 py-1 text-xs font-medium rounded ${
                        session.status === 'open'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {session.status.toUpperCase()}
                    </span>
                    <span className="text-sm text-gray-600">
                      {formatDateTime(session.openedAt)}
                      {session.closedAt && ` - ${formatDateTime(session.closedAt)}`}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                    <div>
                      <p className="text-gray-600">Opening</p>
                      <p className="font-semibold">
                        {formatCurrency(session.openingCash)}
                      </p>
                    </div>
                    {session.status === 'closed' && (
                      <>
                        <div>
                          <p className="text-gray-600">Closing</p>
                          <p className="font-semibold">
                            {formatCurrency(session.closingCash || 0)}
                          </p>
                        </div>
                        <div>
                          <p className="text-gray-600">Expected</p>
                          <p className="font-semibold">
                            {formatCurrency(session.expectedCash || 0)}
                          </p>
                        </div>
                        <div>
                          <p className="text-gray-600">Difference</p>
                          <p
                            className={`font-semibold ${
                              (session.cashDifference || 0) !== 0
                                ? (session.cashDifference || 0) > 0
                                  ? 'text-green-600'
                                  : 'text-red-600'
                                : ''
                            }`}
                          >
                            {session.cashDifference !== null &&
                            session.cashDifference !== 0
                              ? (session.cashDifference > 0 ? '+' : '') +
                                formatCurrency(session.cashDifference)
                              : formatCurrency(0)}
                          </p>
                        </div>
                      </>
                    )}
                    <div>
                      <p className="text-gray-600">Sales / Orders</p>
                      <p className="font-semibold">
                        {formatCurrency(session.totalSales)} / {session.totalOrders}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          ))}

          {recentSessions.length === 0 && (
            <Card padding="lg">
              <p className="text-center text-gray-500">No register sessions yet</p>
            </Card>
          )}
        </div>
      </div>

      {/* Open Register Modal */}
      <Modal
        isOpen={isOpenModalOpen}
        onClose={() => setIsOpenModalOpen(false)}
        title="Open Register"
        size="md"
      >
        <form onSubmit={openForm.handleSubmit(handleOpenRegister)} className="space-y-4">
          <Input
            label="Opening Cash Amount (Rs)"
            type="number"
            step="0.01"
            placeholder="0.00"
            error={openForm.formState.errors.openingCash?.message}
            helperText="Enter the cash amount in the register drawer"
            {...openForm.register('openingCash', { valueAsNumber: true })}
          />

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-900">
              <strong>Note:</strong> Opening the register will start a new session. You can
              begin taking orders after opening the register.
            </p>
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsOpenModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" variant="success" isLoading={isLoading}>
              Open Register
            </Button>
          </div>
        </form>
      </Modal>

      {/* Close Register Modal */}
      <Modal
        isOpen={isCloseModalOpen}
        onClose={() => setIsCloseModalOpen(false)}
        title="Close Register"
        size="md"
      >
        <form onSubmit={closeForm.handleSubmit(handleCloseRegister)} className="space-y-4">
          {currentSession && sessionStats && (
            <div className="bg-gray-50 rounded-lg p-4 mb-4">
              <h3 className="font-semibold text-gray-900 mb-3">Session Summary</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Opening Cash:</span>
                  <span className="font-semibold">
                    {formatCurrency(currentSession.openingCash)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Total Sales:</span>
                  <span className="font-semibold">
                    {formatCurrency(sessionStats.totalSales)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Cash Sales:</span>
                  <span className="font-semibold">
                    {formatCurrency(sessionStats.paymentsByMethod?.cash || 0)}
                  </span>
                </div>
                <div className="flex justify-between border-t border-gray-300 pt-2 font-semibold">
                  <span>Expected Cash:</span>
                  <span>
                    {formatCurrency(
                      currentSession.openingCash +
                        (sessionStats.paymentsByMethod?.cash || 0)
                    )}
                  </span>
                </div>
              </div>
            </div>
          )}

          <Input
            label="Actual Cash in Drawer (Rs)"
            type="number"
            step="0.01"
            placeholder="0.00"
            error={closeForm.formState.errors.closingCash?.message}
            helperText="Count all cash in the drawer"
            {...closeForm.register('closingCash', { valueAsNumber: true })}
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notes (Optional)
            </label>
            <textarea
              className="block w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              rows={3}
              placeholder="Any notes about this session..."
              {...closeForm.register('notes')}
            />
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="text-sm text-yellow-900">
              <strong>Warning:</strong> Closing the register will end this session. Make
              sure all orders are completed and cash is counted.
            </p>
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsCloseModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" variant="danger" isLoading={isLoading}>
              Close Register
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
