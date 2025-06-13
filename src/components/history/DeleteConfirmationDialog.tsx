'use client'

import React from 'react'
import { AlertTriangle, Loader2 } from 'lucide-react'
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
        <DialogHeader>
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-6 w-6 text-destructive flex-shrink-0" />
            <div>
              <DialogTitle>Delete Subject</DialogTitle>
              <DialogDescription className="space-y-2">
                <p>Are you sure you want to delete &quot;{subjectName}&quot;?</p>
                <p className="text-sm text-muted-foreground">
                  This will permanently delete:
                </p>
                <ul className="list-disc pl-4 text-sm text-muted-foreground space-y-1">
                  <li>All chat messages and conversation history</li>
                  <li>Any interactive content and exercises</li>
                  <li>Learning progress and achievements</li>
                  <li>Custom settings and preferences</li>
                </ul>
                <p className="text-sm font-medium text-destructive mt-2">
                  This action cannot be undone.
                </p>
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={isDeleting}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={isDeleting}>
            {isDeleting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Deleting...
              </>
            ) : (
              'Delete Subject'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
