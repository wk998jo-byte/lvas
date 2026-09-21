"use client";

import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Vehicle } from "@/types/database";

export type VehicleFormState = {
  plate_number: string;
  make: string;
  model: string;
  year: string;
  color: string;
  notes: string;
};

export function vehicleToFormState(vehicle?: Vehicle | null): VehicleFormState {
  return {
    plate_number: vehicle?.plate_number ?? "",
    make: vehicle?.make ?? "",
    model: vehicle?.model ?? "",
    year: vehicle?.year?.toString() ?? "",
    color: vehicle?.color ?? "",
    notes: vehicle?.notes ?? "",
  };
}

type VehicleFormProps = {
  initial?: Vehicle | null;
  submitLabel: string;
  pending?: boolean;
  error?: string | null;
  onSubmit: (values: VehicleFormState) => void | Promise<void>;
  onCancel?: () => void;
};

export function VehicleForm({
  initial,
  submitLabel,
  pending = false,
  error,
  onSubmit,
  onCancel,
}: VehicleFormProps) {
  const [values, setValues] = useState<VehicleFormState>(() =>
    vehicleToFormState(initial),
  );

  function update<K extends keyof VehicleFormState>(
    key: K,
    value: VehicleFormState[K],
  ) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onSubmit(values);
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="plate_number">Plate number</Label>
          <Input
            id="plate_number"
            required
            value={values.plate_number}
            onChange={(e) => update("plate_number", e.target.value)}
            disabled={pending}
            className="h-11 rounded-xl"
            placeholder="e.g. ABC 1234"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="make">Make</Label>
          <Input
            id="make"
            required
            value={values.make}
            onChange={(e) => update("make", e.target.value)}
            disabled={pending}
            className="h-11 rounded-xl"
            placeholder="Toyota"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="model">Model</Label>
          <Input
            id="model"
            required
            value={values.model}
            onChange={(e) => update("model", e.target.value)}
            disabled={pending}
            className="h-11 rounded-xl"
            placeholder="Camry"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="year">Year</Label>
          <Input
            id="year"
            type="number"
            min={1980}
            max={2100}
            value={values.year}
            onChange={(e) => update("year", e.target.value)}
            disabled={pending}
            className="h-11 rounded-xl"
            placeholder="Optional"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="color">Color</Label>
          <Input
            id="color"
            value={values.color}
            onChange={(e) => update("color", e.target.value)}
            disabled={pending}
            className="h-11 rounded-xl"
            placeholder="Optional"
          />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="notes">Notes</Label>
          <Textarea
            id="notes"
            value={values.notes}
            onChange={(e) => update("notes", e.target.value)}
            disabled={pending}
            placeholder="Optional fleet notes"
            className="min-h-24 rounded-xl"
          />
        </div>
      </div>

      {error ? (
        <p
          className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
        {onCancel ? (
          <Button
            type="button"
            variant="outline"
            className="rounded-full"
            onClick={onCancel}
            disabled={pending}
          >
            Cancel
          </Button>
        ) : null}
        <Button type="submit" className="rounded-full" disabled={pending}>
          {pending ? "Saving…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}
