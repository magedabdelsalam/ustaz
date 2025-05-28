'use client'

import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog'

interface DeleteConfirmationDialogProps {
  open: boolean
  subjectName: string
  isDeleting: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function DeleteConfirmationDialog({
  open,
  subjectName,
  isDeleting,
  onConfirm,
  onCancel
}: DeleteConfirmationDialogProps) {
  return (
    <Dialog open={open} onOpenChange={open ? onCancel : undefined}>
      <DialogContent>
        <DialogHeader className="flex items-start space-x-3">
          <AlertTriangle className="h-6 w-6 text-orange-500 flex-shrink-0" />
          <div>
            <DialogTitle>Delete Subject</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{subjectName}&quot;?
              <br />
              <strong>This action cannot be undone.</strong> All chat messages, interactive content and progress will be permanently deleted.
            </DialogDescription>
          </div>
        </DialogHeader>
        <DialogFooter className="flex space-x-3 justify-end pt-4">
          <Button variant="outline" onClick={onCancel} disabled={isDeleting}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={isDeleting}>
            {isDeleting ? 'Deleting...' : 'Delete Subject'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
