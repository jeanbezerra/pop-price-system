"use client";

import { useState } from "react";
import { Combobox, Field, Option } from "@fluentui/react-components";
import type { ComponentCategory } from "@/lib/component-contracts";

const normalized = (text: string) =>
  text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase();

export function ComponentCategoryPicker({
  categories,
  value,
  legacyValue,
  generic,
  disabled,
  invalid,
  onChange,
}: {
  categories: ComponentCategory[];
  value: string;
  legacyValue?: string;
  generic: boolean;
  disabled: boolean;
  invalid: boolean;
  onChange: (value: string) => void;
}) {
  const [search, setSearch] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const selected = categories.find((category) => category.code === value);
  const legacy =
    !!legacyValue &&
    !categories.some((category) => category.code === legacyValue);
  const label =
    selected?.name ||
    (value === legacyValue && legacy ? `${value} (categoria anterior)` : "");
  const options =
    search === null
      ? categories
      : categories.filter((category) =>
          normalized(`${category.name} ${category.originalName}`).includes(
            normalized(search),
          ),
        );
  return (
    <Field
      label="Categoria de arquitetura"
      required
      validationState={invalid ? "error" : "none"}
      validationMessage={
        invalid ? "Selecione uma categoria da lista." : undefined
      }
      hint={
        legacy && value === legacyValue
          ? "Categoria anterior preservada. Você pode substituí-la por uma opção da lista."
          : !categories.length
            ? "Categorias deste provedor ainda não estão disponíveis. A biblioteca precisa ser importada."
            : generic
              ? "Categorias neutras mantidas pelo portal."
              : "Classificação oficial do provedor, com rótulos em português e nomes originais na lista."
      }
    >
      <Combobox
        value={search ?? label}
        selectedOptions={value ? [value] : []}
        freeform={false}
        open={open}
        inlinePopup
        disabled={disabled || (!categories.length && !legacy)}
        onChange={(event) => {
          setSearch(event.target.value);
          setOpen(true);
        }}
        onBlur={() => setSearch(null)}
        onOpenChange={(_, data) => {
          setOpen(data.open);
          if (!data.open) setSearch(null);
        }}
        onOptionSelect={(_, data) => {
          const code = data.optionValue;
          if (
            code &&
            (categories.some((category) => category.code === code) ||
              (legacy && code === legacyValue))
          )
            onChange(code);
          setSearch(null);
        }}
      >
        {legacy &&
          (search === null ||
            normalized(legacyValue).includes(normalized(search))) && (
            <Option
              value={legacyValue}
              text={`${legacyValue} (categoria anterior)`}
            >
              {legacyValue} (categoria anterior)
            </Option>
          )}
        {options.map((category) => (
          <Option
            key={category.code}
            value={category.code}
            text={category.name}
          >
            {category.name}
            {category.origin === "PROVIDER" && ` · ${category.originalName}`}
          </Option>
        ))}
        {!options.length && !legacy && (
          <Option disabled>Nenhuma categoria encontrada</Option>
        )}
      </Combobox>
    </Field>
  );
}
