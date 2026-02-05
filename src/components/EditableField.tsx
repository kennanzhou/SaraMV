'use client';

import { useState } from 'react';
import CopyButton from './CopyButton';

interface EditableFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  multiline?: boolean;
  editable?: boolean;
  placeholder?: string;
  rows?: number;
}

export default function EditableField({
  label,
  value,
  onChange,
  multiline = false,
  editable = true,
  placeholder = '',
  rows = 4,
}: EditableFieldProps) {
  return (
    <div className="card">
      <div className="flex items-center justify-between mb-3">
        <label className="text-sm font-medium text-[var(--accent)]">{label}</label>
        <CopyButton text={value} />
      </div>
      
      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="input-field"
          placeholder={placeholder}
          rows={rows}
          readOnly={!editable}
        />
      ) : (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="input-field"
          placeholder={placeholder}
          readOnly={!editable}
        />
      )}
    </div>
  );
}
