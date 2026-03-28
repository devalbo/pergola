import type { ExampleListItem, ExampleParamsSchema, ParamField } from "../cad/project/types";
import { defaultParamValues } from "../cad/project/types";

function debounce<T extends (...args: Parameters<T>) => void>(
  fn: T,
  ms: number,
): (...args: Parameters<T>) => void {
  let t: ReturnType<typeof setTimeout> | undefined;
  return (...args: Parameters<T>) => {
    if (t !== undefined) clearTimeout(t);
    t = setTimeout(() => {
      t = undefined;
      fn(...args);
    }, ms);
  };
}

function readFormValues(
  form: HTMLFormElement,
  schema: ExampleParamsSchema,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const f of schema.fields) {
    const el = form.elements.namedItem(f.id);
    if (el instanceof HTMLInputElement) {
      const n = parseFloat(el.value);
      out[f.id] = Number.isFinite(n) ? n : f.default;
    } else {
      out[f.id] = f.default;
    }
  }
  return out;
}

function applyFieldConstraints(value: number, field: ParamField): number {
  let v = value;
  if (field.min !== undefined) v = Math.max(field.min, v);
  if (field.max !== undefined) v = Math.min(field.max, v);
  return v;
}

export type ExampleParamPanelApi = {
  /** Toolbar control: toggles the parameter panel. Hidden when the example has no schema. */
  paramsButton: HTMLButtonElement;
  /** Call after switching examples so the form matches the selection. */
  syncToExample: (exampleId: string) => void;
  /** Values to pass to `createMesh` for the given example (`undefined` if the example has no form). */
  getValuesForExample: (exampleId: string) => Record<string, number> | undefined;
};

export function createExampleParamPanel(
  examples: ExampleListItem[],
  onValuesApplied: (exampleId: string, values: Record<string, number> | undefined) => void,
): ExampleParamPanelApi {
  const valuesByExampleId = new Map<string, Record<string, number>>();
  let activeExampleId = "";
  let activeSchema: ExampleParamsSchema | undefined;

  const panelId = "example-params-panel";
  const formId = "example-params-form";

  const paramsButton = document.createElement("button");
  paramsButton.type = "button";
  paramsButton.textContent = "Parameters";
  paramsButton.title = "Show or hide inputs for the selected example (live preview)";
  paramsButton.hidden = true;
  paramsButton.setAttribute("aria-expanded", "false");
  paramsButton.setAttribute("aria-controls", panelId);
  paramsButton.style.cssText = [
    "padding:6px 11px",
    "border-radius:6px",
    "border:1px solid #394556",
    "background:#243040",
    "color:inherit",
    "cursor:pointer",
    "font:inherit",
    "white-space:nowrap",
  ].join(";");

  const panel = document.createElement("aside");
  panel.id = panelId;
  panel.hidden = true;
  panel.setAttribute("role", "region");
  panel.setAttribute("aria-label", "Scene parameters");
  panel.style.cssText = [
    "position:fixed",
    "top:52px",
    "left:12px",
    "z-index:10",
    "width:min(380px,calc(100vw - 24px))",
    "max-height:min(420px,calc(100vh - 64px))",
    "overflow:auto",
    "padding:12px 14px",
    "background:rgba(15,20,28,0.94)",
    "color:#e8eef5",
    "font:13px/1.4 system-ui,sans-serif",
    "border-radius:8px",
    "border:1px solid #2a3544",
    "box-shadow:0 8px 24px rgba(0,0,0,.35)",
  ].join(";");

  const title = document.createElement("h2");
  title.style.cssText = "margin:0 0 10px;font-size:13px;font-weight:600;opacity:0.95";
  title.textContent = "Scene parameters";
  panel.appendChild(title);

  const form = document.createElement("form");
  form.id = formId;
  form.setAttribute("novalidate", "");
  form.style.cssText = "margin:0;display:flex;flex-direction:column;gap:10px";
  panel.appendChild(form);

  const applyDebounced = debounce((exampleId: string, values: Record<string, number> | undefined) => {
    onValuesApplied(exampleId, values);
  }, 90);

  function scheduleApply(): void {
    if (!activeSchema?.fields?.length || !activeExampleId) return;
    const vals = readFormValues(form, activeSchema);
    valuesByExampleId.set(activeExampleId, vals);
    applyDebounced(activeExampleId, vals);
  }

  form.addEventListener("input", () => scheduleApply());
  form.addEventListener("change", () => scheduleApply());

  function setPanelOpen(open: boolean): void {
    panel.hidden = !open;
    paramsButton.setAttribute("aria-expanded", open ? "true" : "false");
  }

  paramsButton.addEventListener("click", () => {
    setPanelOpen(Boolean(panel.hidden));
  });

  document.addEventListener("keydown", (ev) => {
    if (ev.key !== "Escape" || panel.hidden || paramsButton.hidden) return;
    setPanelOpen(false);
  });

  function buildForm(schema: ExampleParamsSchema): void {
    form.replaceChildren();
    const fs = document.createElement("fieldset");
    fs.style.cssText = "margin:0;padding:0;border:none;display:flex;flex-direction:column;gap:10px";

    for (const field of schema.fields) {
      const row = document.createElement("div");
      row.style.cssText = "display:flex;flex-direction:column;gap:4px";

      const lab = document.createElement("label");
      lab.htmlFor = `param-${field.id}`;
      lab.textContent = field.label;
      lab.style.cssText = "opacity:0.9";

      const input = document.createElement("input");
      input.type = "number";
      input.id = `param-${field.id}`;
      input.name = field.id;
      if (field.min !== undefined) input.min = String(field.min);
      if (field.max !== undefined) input.max = String(field.max);
      if (field.step !== undefined) input.step = String(field.step);
      input.value = String(field.default);
      input.style.cssText =
        "padding:6px 8px;border-radius:6px;border:1px solid #394556;background:#1a222c;color:inherit;width:100%";

      input.addEventListener("blur", () => {
        const raw = parseFloat(input.value);
        if (!Number.isFinite(raw)) {
          input.value = String(field.default);
          return;
        }
        const clamped = applyFieldConstraints(raw, field);
        if (clamped !== raw) input.value = String(clamped);
      });

      row.append(lab, input);
      fs.appendChild(row);
    }

    form.appendChild(fs);
  }

  function fillForm(schema: ExampleParamsSchema, values: Record<string, number>): void {
    for (const f of schema.fields) {
      const el = form.elements.namedItem(f.id);
      if (el instanceof HTMLInputElement) {
        const v = values[f.id] ?? f.default;
        el.value = String(applyFieldConstraints(v, f));
      }
    }
  }

  function syncToExample(exampleId: string): void {
    activeExampleId = exampleId;
    const ex = examples.find((e) => e.id === exampleId);
    activeSchema = ex?.paramSchema;

    if (!activeSchema || activeSchema.fields.length === 0) {
      paramsButton.hidden = true;
      panel.hidden = true;
      paramsButton.setAttribute("aria-expanded", "false");
      form.replaceChildren();
      return;
    }

    paramsButton.hidden = false;
    buildForm(activeSchema);
    const initial = valuesByExampleId.get(exampleId) ?? defaultParamValues(activeSchema);
    valuesByExampleId.set(exampleId, initial);
    fillForm(activeSchema, initial);
  }

  function getValuesForExample(exampleId: string): Record<string, number> | undefined {
    const ex = examples.find((e) => e.id === exampleId);
    if (!ex?.paramSchema.fields.length) return undefined;
    return valuesByExampleId.get(exampleId) ?? defaultParamValues(ex.paramSchema);
  }

  document.body.appendChild(panel);

  return {
    paramsButton,
    syncToExample,
    getValuesForExample,
  };
}
