import React from "react";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { FormProvider, useForm } from "react-hook-form";
import type { RuleResolveOn } from "@/utils/hooks/useRules";
import { DEFAULT_CORRELATION_FORM_VALUES } from "..";
import { ResolveOnField } from "../ResolveOnField";
import type { CorrelationFormType } from "../types";

const Harness = ({ initial }: { initial: RuleResolveOn }) => {
  const methods = useForm<CorrelationFormType>({
    defaultValues: { ...DEFAULT_CORRELATION_FORM_VALUES, resolveOn: initial },
    mode: "onChange",
  });
  return (
    <FormProvider {...methods}>
      <ResolveOnField />
      <output data-testid="valid">{String(methods.formState.isValid)}</output>
      <output data-testid="value">{methods.watch("resolveOn")}</output>
    </FormProvider>
  );
};

const renderField = (initial: RuleResolveOn) =>
  render(<Harness initial={initial} />);

// Tremor's Select also renders a hidden native <select> whose <option>s are
// role=option, so scope option queries to the popup listbox.
const openSelect = async () => {
  fireEvent.click(screen.getByRole("button"));
  return within(await screen.findByRole("listbox"));
};

describe("ResolveOnField", () => {
  it("offers only No auto-resolution and All alerts resolved", async () => {
    renderField("never");
    const listbox = await openSelect();
    expect(
      listbox.getAllByRole("option").map((option) => option.textContent)
    ).toEqual(["No auto-resolution", "All alerts resolved"]);
  });

  it.each([
    ["first_resolved", "First alert resolved"],
    ["last_resolved", "Last alert resolved"],
  ])(
    "a %s rule shows the notice and cannot be saved",
    async (initial, label) => {
      const { container } = renderField(initial as RuleResolveOn);
      const noticeText = `This rule resolves on "${label}", which is no longer supported. Choose a new option to save changes.`;
      expect(screen.getByText(noticeText)).toBeInTheDocument();
      // Tremor's Text drops unknown props, so assert the selector QA relies on
      // really reaches the DOM and sits on the node that carries the copy.
      const notice = container.querySelector(
        '[data-cy="rules-form-resolve-on-legacy-notice"]'
      );
      expect(notice).not.toBeNull();
      expect(notice).toHaveTextContent(noticeText);
      expect(notice).toHaveAttribute("role", "status");
      expect(
        container.querySelector('[data-cy="rules-form-resolve-on-select"]')
      ).not.toBeNull();
      await waitFor(() =>
        expect(screen.getByTestId("valid")).toHaveTextContent("false")
      );
      const listbox = await openSelect();
      expect(listbox.getAllByRole("option")).toHaveLength(2);
    }
  );

  it("picking All alerts resolved clears the notice and unblocks saving", async () => {
    renderField("first_resolved");
    const listbox = await openSelect();
    fireEvent.click(
      listbox.getByRole("option", { name: "All alerts resolved" })
    );
    expect(screen.queryByText(/no longer supported/)).not.toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByTestId("valid")).toHaveTextContent("true")
    );
    expect(screen.getByTestId("value")).toHaveTextContent("all_resolved");
  });

  it("a never rule shows no notice and is valid", async () => {
    const { container } = renderField("never");
    expect(screen.queryByText(/no longer supported/)).not.toBeInTheDocument();
    expect(
      container.querySelector('[data-cy="rules-form-resolve-on-legacy-notice"]')
    ).toBeNull();
    expect(
      container.querySelector('[data-cy="rules-form-resolve-on-select"]')
    ).not.toBeNull();
    await waitFor(() =>
      expect(screen.getByTestId("valid")).toHaveTextContent("true")
    );
  });
});
