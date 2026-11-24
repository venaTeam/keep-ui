/**
 * @jest-environment node
 */
import type { ApiClient } from "@/shared/api";
import golden from "../../__fixtures__/assistant_stream.json";
import { confirmDraft, discardDraft, getConversation } from "../assistant-api";

const get = jest.fn();
const post = jest.fn();
const api = { get, post } as unknown as ApiClient;

beforeEach(() => {
  jest.resetAllMocks();
});

it("reads a conversation, past the HTTP cache", async () => {
  get.mockResolvedValue(golden.conversations.finished);
  await expect(getConversation(api, "c-1")).resolves.toEqual(
    golden.conversations.finished
  );
  expect(get).toHaveBeenCalledWith("/assistant/conversations/c-1", {
    cache: "no-store",
  });
});

it("escapes ids, which may come from local storage", async () => {
  get.mockResolvedValue(golden.conversations.finished);
  await getConversation(api, "../drafts/x?y");
  expect(get.mock.calls[0][0]).toBe(
    "/assistant/conversations/..%2Fdrafts%2Fx%3Fy"
  );
});

it("confirms and discards a draft without a body", async () => {
  post.mockResolvedValue(golden.drafts.applied);
  await expect(confirmDraft(api, "d-1")).resolves.toEqual(
    golden.drafts.applied
  );
  post.mockResolvedValue(golden.drafts.discarded);
  await expect(discardDraft(api, "d-1")).resolves.toEqual(
    golden.drafts.discarded
  );
  expect(post.mock.calls).toEqual([
    ["/assistant/drafts/d-1/confirm"],
    ["/assistant/drafts/d-1/discard"],
  ]);
});

it.each([[null], ["<html></html>"], [{}]])(
  "rejects the answer %j instead of returning it",
  async (body) => {
    get.mockResolvedValue(body);
    post.mockResolvedValue(body);
    await expect(getConversation(api, "c-1")).rejects.toThrow("Unexpected");
    await expect(confirmDraft(api, "d-1")).rejects.toThrow("Unexpected");
    await expect(discardDraft(api, "d-1")).rejects.toThrow("Unexpected");
  }
);
