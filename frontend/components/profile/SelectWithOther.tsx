"use client";

import React, { useState } from "react";

const OTHER_SENTINEL = "__other__";

export interface SelectWithOtherProps {
  id: string;
  name?: string;
  value: string;
  onChange: (nextValue: string) => void;
  options: readonly string[];
  placeholder: string;
  customPlaceholder?: string;
  ariaLabel?: string;
  disabled?: boolean;
  required?: boolean;
  maxLength?: number;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  selectClassName?: string;
  inputClassName?: string;
  selectStyle?: React.CSSProperties;
  inputStyle?: React.CSSProperties;
}

export default function SelectWithOther({
  id,
  name,
  value,
  onChange,
  options,
  placeholder,
  customPlaceholder = "Enter manually",
  ariaLabel,
  disabled = false,
  required = false,
  maxLength = 250,
  inputMode = "text",
  selectClassName,
  inputClassName,
  selectStyle,
  inputStyle,
}: SelectWithOtherProps) {
  const [customMode, setCustomMode] = useState(false);

  const trimmed = value.trim();
  const isPreset = options.includes(value);
  const showCustomInput = customMode;
  const selectValue = showCustomInput ? OTHER_SENTINEL : value;

  const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const picked = e.target.value;
    if (picked === OTHER_SENTINEL) {
      setCustomMode(true);
      onChange("");
    } else {
      setCustomMode(false);
      onChange(picked);
    }
  };

  return (
    <>
      <select
        id={id}
        name={name}
        value={selectValue}
        onChange={handleSelectChange}
        aria-label={ariaLabel}
        disabled={disabled}
        required={required && !showCustomInput}
        className={selectClassName}
        style={selectStyle}
      >
        <option value="">{placeholder}</option>
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
        {trimmed && !isPreset && !showCustomInput && (
          <option value={value}>{value}</option>
        )}
        <option value={OTHER_SENTINEL}>Other (type manually)</option>
      </select>

      {showCustomInput && (
        <input
          id={`${id}-custom`}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={customPlaceholder}
          aria-label={ariaLabel ? `${ariaLabel} (custom)` : customPlaceholder}
          disabled={disabled}
          required={required}
          maxLength={maxLength}
          inputMode={inputMode}
          className={inputClassName}
          style={{ marginTop: 8, ...inputStyle }}
          autoFocus
        />
      )}
    </>
  );
}
