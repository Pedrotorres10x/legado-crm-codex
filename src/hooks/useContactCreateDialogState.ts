import { useEffect, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { SetURLSearchParams } from 'react-router-dom';
import type { ContactCreateForm } from '@/hooks/useContactCreate';

type Params = {
  searchParams: URLSearchParams;
  setSearchParams: SetURLSearchParams;
  emptyForm: ContactCreateForm;
};

type UseContactCreateDialogStateResult = {
  dialogOpen: boolean;
  setDialogOpen: Dispatch<SetStateAction<boolean>>;
  dialogStep: 'type' | 'form';
  setDialogStep: Dispatch<SetStateAction<'type' | 'form'>>;
  form: ContactCreateForm;
  setForm: Dispatch<SetStateAction<ContactCreateForm>>;
  formTags: string[];
  setFormTags: Dispatch<SetStateAction<string[]>>;
  formTagInput: string;
  setFormTagInput: Dispatch<SetStateAction<string>>;
  openCreateDialog: () => void;
  closeCreateDialog: () => void;
  handleDialogOpenChange: (open: boolean) => void;
  resetCreateDialog: () => void;
};

export function useContactCreateDialogState({
  searchParams,
  setSearchParams,
  emptyForm,
}: Params): UseContactCreateDialogStateResult {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogStep, setDialogStep] = useState<'type' | 'form'>('type');
  const [formTags, setFormTags] = useState<string[]>([]);
  const [formTagInput, setFormTagInput] = useState('');
  const [form, setForm] = useState<ContactCreateForm>(emptyForm);

  useEffect(() => {
    setForm(emptyForm);
  }, [emptyForm]);

  useEffect(() => {
    if (searchParams.get('quickCreate') === '1') {
      setDialogOpen(true);
    }
  }, [searchParams]);

  const clearQuickCreateParam = () => {
    if (searchParams.get('quickCreate') !== '1') return;

    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete('quickCreate');
      return next;
    }, { replace: true });
  };

  const resetCreateDialog = () => {
    setDialogStep('type');
    setForm(emptyForm);
    setFormTags([]);
    setFormTagInput('');
  };

  const closeCreateDialog = () => {
    setDialogOpen(false);
    clearQuickCreateParam();
    resetCreateDialog();
  };

  const handleDialogOpenChange = (open: boolean) => {
    if (open) {
      setDialogOpen(true);
      return;
    }

    closeCreateDialog();
  };

  const openCreateDialog = () => {
    setDialogOpen(true);
  };

  return {
    dialogOpen,
    setDialogOpen,
    dialogStep,
    setDialogStep,
    form,
    setForm,
    formTags,
    setFormTags,
    formTagInput,
    setFormTagInput,
    openCreateDialog,
    closeCreateDialog,
    handleDialogOpenChange,
    resetCreateDialog,
  };
}
