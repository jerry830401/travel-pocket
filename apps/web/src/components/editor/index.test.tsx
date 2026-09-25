import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  EditModal,
  FieldInput,
  FieldTextarea,
  FieldSelect,
  FieldTags,
  EditBtn,
  DeleteBtn,
  AddBtn,
  DevBanner,
} from "./index";

vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
      <div {...props}>{children}</div>
    ),
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

/* ── EditModal ─────────────────────────────────────────────────── */

describe("EditModal", () => {
  it("open=false 時不渲染任何內容", () => {
    render(
      <EditModal title="測試" open={false} onClose={vi.fn()} onSave={vi.fn()}>
        <div>modal body</div>
      </EditModal>
    );
    expect(screen.queryByText("modal body")).not.toBeInTheDocument();
  });

  it("open=true 時顯示標題", () => {
    render(
      <EditModal title="編輯行程" open={true} onClose={vi.fn()} onSave={vi.fn()}>
        <div>modal body</div>
      </EditModal>
    );
    expect(screen.getByText(/編輯行程/)).toBeInTheDocument();
  });

  it("open=true 時顯示子元素", () => {
    render(
      <EditModal title="T" open={true} onClose={vi.fn()} onSave={vi.fn()}>
        <div>child content</div>
      </EditModal>
    );
    expect(screen.getByText("child content")).toBeInTheDocument();
  });

  it("點擊取消按鈕觸發 onClose", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <EditModal title="T" open={true} onClose={onClose} onSave={vi.fn()}>
        <div />
      </EditModal>
    );
    await user.click(screen.getByRole("button", { name: "取消" }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("點擊儲存按鈕觸發 onSave", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(
      <EditModal title="T" open={true} onClose={vi.fn()} onSave={onSave}>
        <div />
      </EditModal>
    );
    await user.click(screen.getByRole("button", { name: "儲存" }));
    expect(onSave).toHaveBeenCalledOnce();
  });

  it("saving=true 時儲存按鈕顯示儲存中並 disabled", () => {
    render(
      <EditModal title="T" open={true} onClose={vi.fn()} onSave={vi.fn()} saving={true}>
        <div />
      </EditModal>
    );
    const btn = screen.getByRole("button", { name: "儲存中…" });
    expect(btn).toBeDisabled();
  });

  it("點擊關閉按鈕（×）觸發 onClose", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <EditModal title="T" open={true} onClose={onClose} onSave={vi.fn()}>
        <div />
      </EditModal>
    );
    await user.click(screen.getByRole("button", { name: "×" }));
    expect(onClose).toHaveBeenCalledOnce();
  });
});

/* ── FieldInput ────────────────────────────────────────────────── */

describe("FieldInput", () => {
  it("顯示 label 文字", () => {
    render(<FieldInput label="店名" value="" onChange={vi.fn()} />);
    expect(screen.getByText("店名")).toBeInTheDocument();
  });

  it("渲染 input 並顯示 value", () => {
    render(<FieldInput label="店名" value="測試值" onChange={vi.fn()} />);
    expect(screen.getByRole("textbox")).toHaveValue("測試值");
  });

  it("使用者輸入時觸發 onChange", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<FieldInput label="店名" value="" onChange={onChange} />);
    await user.type(screen.getByRole("textbox"), "A");
    expect(onChange).toHaveBeenCalledWith("A");
  });

  it("type=url 時 input 類型為 url", () => {
    render(<FieldInput label="URL" value="" onChange={vi.fn()} type="url" />);
    expect(screen.getByRole("textbox")).toHaveAttribute("type", "url");
  });
});

/* ── FieldTextarea ─────────────────────────────────────────────── */

describe("FieldTextarea", () => {
  it("顯示 label 文字", () => {
    render(<FieldTextarea label="備註" value="" onChange={vi.fn()} />);
    expect(screen.getByText("備註")).toBeInTheDocument();
  });

  it("渲染 textarea 並顯示 value", () => {
    render(<FieldTextarea label="備註" value="初始內容" onChange={vi.fn()} />);
    expect(screen.getByRole("textbox")).toHaveValue("初始內容");
  });

  it("使用者輸入時觸發 onChange", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<FieldTextarea label="備註" value="" onChange={onChange} />);
    await user.type(screen.getByRole("textbox"), "X");
    expect(onChange).toHaveBeenCalledWith("X");
  });
});

/* ── FieldSelect ───────────────────────────────────────────────── */

describe("FieldSelect", () => {
  const options = [
    { value: "food", label: "食物" },
    { value: "hotel", label: "住宿" },
  ];

  it("顯示 label 文字", () => {
    render(<FieldSelect label="類別" value="food" onChange={vi.fn()} options={options} />);
    expect(screen.getByText("類別")).toBeInTheDocument();
  });

  it("渲染所有 option", () => {
    render(<FieldSelect label="類別" value="food" onChange={vi.fn()} options={options} />);
    expect(screen.getByRole("option", { name: "食物" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "住宿" })).toBeInTheDocument();
  });

  it("選擇不同選項時觸發 onChange", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<FieldSelect label="類別" value="food" onChange={onChange} options={options} />);
    await user.selectOptions(screen.getByRole("combobox"), "hotel");
    expect(onChange).toHaveBeenCalledWith("hotel");
  });
});

/* ── FieldTags ─────────────────────────────────────────────────── */

describe("FieldTags", () => {
  it("顯示 label（含「逗號分隔」說明）", () => {
    render(<FieldTags label="標籤" value={[]} onChange={vi.fn()} />);
    expect(screen.getByText(/標籤/)).toBeInTheDocument();
    expect(screen.getByText(/逗號分隔/)).toBeInTheDocument();
  });

  it("將 string[] 顯示為逗號分隔字串", () => {
    render(<FieldTags label="標籤" value={["家電", "3C"]} onChange={vi.fn()} />);
    expect(screen.getByRole("textbox")).toHaveValue("家電, 3C");
  });

  it("輸入逗號分隔字串時 onChange 回傳 string[]", () => {
    const onChange = vi.fn();
    render(<FieldTags label="標籤" value={[]} onChange={onChange} />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "美食" } });
    expect(onChange).toHaveBeenCalledWith(["美食"]);
  });
});

/* ── EditBtn / DeleteBtn / AddBtn ──────────────────────────────── */

describe("EditBtn", () => {
  it("點擊時觸發 onClick", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<EditBtn onClick={onClick} />);
    await user.click(screen.getByRole("button", { name: "編輯" }));
    expect(onClick).toHaveBeenCalledOnce();
  });
});

describe("DeleteBtn", () => {
  it("點擊時觸發 onClick", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<DeleteBtn onClick={onClick} />);
    await user.click(screen.getByRole("button", { name: "刪除" }));
    expect(onClick).toHaveBeenCalledOnce();
  });
});

describe("AddBtn", () => {
  it("顯示預設文字「新增」", () => {
    render(<AddBtn onClick={vi.fn()} />);
    expect(screen.getByRole("button", { name: /新增/ })).toBeInTheDocument();
  });

  it("顯示自訂 label", () => {
    render(<AddBtn onClick={vi.fn()} label="新增店家" />);
    expect(screen.getByRole("button", { name: /新增店家/ })).toBeInTheDocument();
  });

  it("點擊時觸發 onClick", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<AddBtn onClick={onClick} />);
    await user.click(screen.getByRole("button", { name: /新增/ }));
    expect(onClick).toHaveBeenCalledOnce();
  });
});

/* ── DevBanner ─────────────────────────────────────────────────── */

describe("DevBanner", () => {
  it("顯示 DEV EDIT MODE 文字", () => {
    render(<DevBanner />);
    expect(screen.getByText(/DEV EDIT MODE/)).toBeInTheDocument();
  });
});
