"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { IconUserPlus, IconTrash } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { addUser, removeUser, type WardUser } from "./actions";

export function UsersView({
  users,
  currentUserId,
}: {
  users: WardUser[];
  currentUserId: string;
}) {
  const [addOpen, setAddOpen] = useState(false);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold text-foreground">
          User management
        </h1>
        <p className="text-sm text-muted-foreground">
          {users.length} user{users.length === 1 ? "" : "s"} in your ward.
        </p>
      </header>

      <div className="flex justify-end">
        <AddUserDialog
          open={addOpen}
          onOpenChange={setAddOpen}
        />
      </div>

      {users.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          No users yet.
        </p>
      ) : (
        <>
          {/* Desktop: table */}
          <div className="hidden sm:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead className="w-16" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">
                      <span className="flex items-center gap-2">
                        {u.name}
                        {u.is_self && (
                          <Badge variant="secondary">you</Badge>
                        )}
                      </span>
                    </TableCell>
                    <TableCell>{u.email}</TableCell>
                    <TableCell>
                      <RemoveUserButton user={u} users={users} currentUserId={currentUserId} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Mobile: list */}
          <ul className="flex flex-col divide-y divide-border sm:hidden">
            {users.map((u) => (
              <li
                key={u.id}
                className="flex flex-col gap-1 py-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2 text-sm font-medium">
                    {u.name}
                    {u.is_self && (
                      <Badge variant="secondary">you</Badge>
                    )}
                  </span>
                  <RemoveUserButton user={u} users={users} currentUserId={currentUserId} />
                </div>
                <span className="text-sm text-muted-foreground">{u.email}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function AddUserDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function reset() {
    setEmail("");
    setName("");
    setError(null);
  }

  function handleOpenChange(next: boolean) {
    onOpenChange(next);
    if (!next) reset();
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await addUser(email, name);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.success("User added.");
      handleOpenChange(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button>
          <IconUserPlus />
          Add user
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add user</DialogTitle>
          <DialogDescription>
            Add a new user to your ward. They will be able to log in with a
            code sent to their email.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="new-user-name">Name</Label>
            <Input
              id="new-user-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Jane Doe"
              required
              autoComplete="name"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="new-user-email">Email</Label>
            <Input
              id="new-user-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="jane@example.com"
              required
              autoComplete="email"
            />
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={isPending}>
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Adding…" : "Add user"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function RemoveUserButton({
  user,
  users,
  currentUserId,
}: {
  user: WardUser;
  users: WardUser[];
  currentUserId: string;
}) {
  const [open, setOpen] = useState(false);
  const [reassignTo, setReassignTo] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const candidates = users.filter((u) => u.id !== user.id);

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      setReassignTo("");
      setError(null);
    }
  }

  function handleConfirm(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!reassignTo) {
      setError("Please select a user to reassign tasks to.");
      return;
    }
    startTransition(async () => {
      const result = await removeUser(user.id, reassignTo);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.success(`${user.name} removed.`);
      handleOpenChange(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`Remove ${user.name}`}
          disabled={user.id === currentUserId}
        >
          <IconTrash className="text-destructive" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Remove {user.name}?</DialogTitle>
          <DialogDescription>
            Anything assigned to this member (e.g. tasks) will be reassigned to
            the user you choose below. This cannot be undone.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleConfirm} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="reassign-to">Reassign to</Label>
            <Select value={reassignTo} onValueChange={setReassignTo}>
              <SelectTrigger id="reassign-to" className="w-full">
                <SelectValue placeholder="Select a user" />
              </SelectTrigger>
              <SelectContent>
                {candidates.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name} — {c.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={isPending}>
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" variant="destructive" disabled={isPending}>
              {isPending ? "Removing…" : "Remove user"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
