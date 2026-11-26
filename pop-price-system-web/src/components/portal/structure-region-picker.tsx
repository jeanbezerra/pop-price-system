"use client";

import { useState } from "react";
import {
  Checkbox,
  Combobox,
  Field,
  Option,
  OptionGroup,
  Text,
  makeStyles,
  tokens,
} from "@fluentui/react-components";
import type { Region } from "@/lib/portal-contracts";

// Display names only. Available codes always come from the provider's local catalog.
// Reference: https://docs.aws.amazon.com/global-infrastructure/latest/regions/aws-regions.html
const awsNames: Record<string, string> = {
  "sa-east-1": "São Paulo (Brasil)",
  "us-east-1": "Virgínia do Norte (EUA)",
  "us-east-2": "Ohio (EUA)",
  "us-west-1": "Norte da Califórnia (EUA)",
  "us-west-2": "Oregon (EUA)",
  "af-south-1": "Cidade do Cabo (África do Sul)",
  "ap-east-1": "Hong Kong",
  "ap-east-2": "Taipei (Taiwan)",
  "ap-south-1": "Mumbai (Índia)",
  "ap-south-2": "Hyderabad (Índia)",
  "ap-northeast-1": "Tóquio (Japão)",
  "ap-northeast-2": "Seul (Coreia do Sul)",
  "ap-northeast-3": "Osaka (Japão)",
  "ap-southeast-1": "Singapura",
  "ap-southeast-2": "Sydney (Austrália)",
  "ap-southeast-3": "Jacarta (Indonésia)",
  "ap-southeast-4": "Melbourne (Austrália)",
  "ap-southeast-5": "Malásia",
  "ap-southeast-6": "Nova Zelândia",
  "ap-southeast-7": "Tailândia",
  "ca-central-1": "Canadá Central",
  "ca-west-1": "Calgary (Canadá)",
  "eu-central-1": "Frankfurt (Alemanha)",
  "eu-central-2": "Zurique (Suíça)",
  "eu-west-1": "Irlanda",
  "eu-west-2": "Londres (Reino Unido)",
  "eu-west-3": "Paris (França)",
  "eu-south-1": "Milão (Itália)",
  "eu-south-2": "Espanha",
  "eu-north-1": "Estocolmo (Suécia)",
  "il-central-1": "Tel Aviv (Israel)",
  "mx-central-1": "México Central",
  "me-south-1": "Bahrein",
  "me-central-1": "Emirados Árabes Unidos",
};
const normalize = (text: string) =>
  text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("pt-BR");
const isAdvanced = (provider: string, code: string) =>
  provider === "AWS" && !/^[a-z]+(?:-[a-z]+){1,2}-\d+$/.test(code);
const useStyles = makeStyles({
  root: { display: "grid", gap: tokens.spacingVerticalXS, minWidth: 0 },
  control: { width: "100%", minWidth: 0, maxWidth: "100%" },
  list: { maxHeight: "280px" },
  option: {
    display: "flex",
    flexDirection: "column",
    alignItems: "start",
    minWidth: 0,
    gap: tokens.spacingVerticalXXS,
  },
  code: { color: tokens.colorNeutralForeground3 },
});

export function StructureRegionPicker({
  provider,
  regions,
  value,
  label,
  hint,
  disabled,
  onChange,
}: {
  provider: string;
  regions: Region[];
  value: string;
  label: string;
  hint?: string;
  disabled: boolean;
  onChange: (code: string) => void;
}) {
  const styles = useStyles();
  const [search, setSearch] = useState<string | null>(null);
  const [includeAdvanced, setIncludeAdvanced] = useState(
    !!value && isAdvanced(provider, value),
  );
  const [open, setOpen] = useState(false);
  const options = regions
    .map((region) => {
      const name =
        provider === "AWS" ? awsNames[region.code] || region.name : region.name;
      return {
        ...region,
        name: name?.trim() || region.code,
        advanced: isAdvanced(provider, region.code),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  const selected = options.find((region) => region.code === value);
  const textOf = (region: (typeof options)[number]) =>
    region.name === region.code
      ? region.code
      : `${region.name} · ${region.code}`;
  const visible = options.filter(
    (region) =>
      (!region.advanced || includeAdvanced || region.code === value) &&
      (search === null ||
        normalize(`${region.name} ${region.code}`).includes(normalize(search))),
  );
  const renderOption = (region: (typeof options)[number]) => (
    <Option
      key={region.code}
      value={region.code}
      text={textOf(region)}
      aria-label={textOf(region)}
    >
      <span className={styles.option}>
        <Text>{region.name}</Text>
        {region.name !== region.code && (
          <Text size={200} className={styles.code}>
            {region.code}
          </Text>
        )}
      </span>
    </Option>
  );
  return (
    <div className={styles.root}>
      <Field label={label} required hint={hint}>
        <Combobox
          className={styles.control}
          listbox={{ className: styles.list }}
          positioning={{ autoSize: "width" }}
          expandIcon={{ "aria-label": "Mostrar regiões" }}
          required
          disabled={disabled}
          placeholder="Busque por nome ou código"
          value={search ?? (selected ? textOf(selected) : "")}
          selectedOptions={value ? [value] : []}
          freeform={false}
          open={open}
          onOpenChange={(_, data) => {
            setOpen(data.open);
            if (!data.open) setSearch(null);
          }}
          onChange={(event) => {
            setSearch(event.target.value);
            setOpen(true);
            onChange("");
          }}
          onBlur={() => setSearch(null)}
          onOptionSelect={(_, data) => {
            if (
              data.optionValue &&
              regions.some((region) => region.code === data.optionValue)
            ) {
              onChange(data.optionValue);
              setSearch(null);
            } else if (!data.optionValue) {
              onChange("");
            }
          }}
        >
          {!!visible.filter((region) => !region.advanced).length && (
            <OptionGroup label="Regiões">
              {visible.filter((region) => !region.advanced).map(renderOption)}
            </OptionGroup>
          )}
          {!!visible.filter((region) => region.advanced).length && (
            <OptionGroup label="Zonas locais e outras localidades">
              {visible.filter((region) => region.advanced).map(renderOption)}
            </OptionGroup>
          )}
          {!visible.length && (
            <Option disabled>Nenhuma região encontrada</Option>
          )}
        </Combobox>
      </Field>
      {options.some((region) => region.advanced) && (
        <Checkbox
          disabled={disabled}
          label="Incluir zonas locais e outras localidades"
          checked={includeAdvanced}
          onChange={(_, data) => {
            setIncludeAdvanced(data.checked === true);
            setSearch(null);
            if (!data.checked && isAdvanced(provider, value)) onChange("");
          }}
        />
      )}
    </div>
  );
}
