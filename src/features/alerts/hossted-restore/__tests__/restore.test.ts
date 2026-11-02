import { countSources, setHosstedResponse } from "@hossted/keep-integration";
import { restoreHosstedResponse } from "..";

jest.mock("@hossted/keep-integration", () => ({
  HosstedButton: () => null,
  setHosstedResponse: jest.fn(),
  countSources: jest.fn(),
}));

const mockedSet = setHosstedResponse as jest.Mock;
const mockedCount = countSources as jest.Mock;
const fetchMock = jest.fn();

beforeEach(() => {
  mockedSet.mockReset();
  mockedCount.mockReset();
  fetchMock.mockReset();
  global.fetch = fetchMock as unknown as typeof fetch;
});

const jsonRes = (data: unknown, status = 200) =>
  ({ ok: status < 300, status, json: async () => data }) as Response;

describe("restoreHosstedResponse", () => {
  it("gives the stored answer to the widget as a success", async () => {
    fetchMock.mockResolvedValue(
      jsonRes({ summary: "s", response: "<p>r</p>", thread_id: "t1" })
    );

    await restoreHosstedResponse("fp-a");

    expect(fetchMock).toHaveBeenCalledWith("/api/hossted?id=fp-a", {
      signal: expect.any(AbortSignal),
    });
    expect(mockedSet).toHaveBeenCalledWith({
      id: "fp-a",
      status: "success",
      summary: "s",
      response: "<p>r</p>",
      thread_id: "t1",
      sources: undefined,
    });
    expect(mockedCount).toHaveBeenCalledWith(undefined);
  });

  it("builds the source counts from the stored reply's _metadata.sources", async () => {
    const list = [{ _metadata: { category: "hkb", kind: "docs" } }];
    mockedCount.mockReturnValue({ hkb: { docs: 1 } });
    fetchMock.mockResolvedValue(
      jsonRes({ summary: "s", response: "r", _metadata: { sources: list } })
    );

    await restoreHosstedResponse("fp-s");

    expect(mockedCount).toHaveBeenCalledWith(list);
    expect(mockedSet).toHaveBeenCalledWith(
      expect.objectContaining({ id: "fp-s", sources: { hkb: { docs: 1 } } })
    );
  });

  it("keeps the stored reply's own sources counts", async () => {
    fetchMock.mockResolvedValue(
      jsonRes({ summary: "s", response: "r", sources: { ckb: { docs: 2 } } })
    );

    await restoreHosstedResponse("fp-o");

    expect(mockedCount).not.toHaveBeenCalled();
    expect(mockedSet).toHaveBeenCalledWith(
      expect.objectContaining({ sources: { ckb: { docs: 2 } } })
    );
  });

  it("gives up without an error when the request times out", async () => {
    fetchMock.mockRejectedValue(new DOMException("timed out", "TimeoutError"));

    await expect(restoreHosstedResponse("fp-t")).resolves.toBeUndefined();

    expect(mockedSet).not.toHaveBeenCalled();
  });

  it("does nothing when no answer is stored", async () => {
    fetchMock.mockResolvedValue(jsonRes({ error: "Not found" }, 404));

    await restoreHosstedResponse("fp-b");

    expect(mockedSet).not.toHaveBeenCalled();
  });

  it("asks for each alert only once", async () => {
    fetchMock.mockResolvedValue(jsonRes({ error: "Not found" }, 404));

    await restoreHosstedResponse("fp-c");
    await restoreHosstedResponse("fp-c");

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("asks again after a network failure", async () => {
    fetchMock.mockRejectedValueOnce(new Error("offline"));
    fetchMock.mockResolvedValue(jsonRes({ summary: "s", response: "r" }));

    await restoreHosstedResponse("fp-d");
    await restoreHosstedResponse("fp-d");

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(mockedSet).toHaveBeenCalledTimes(1);
  });
});
