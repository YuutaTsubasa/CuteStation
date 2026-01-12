import { writable } from "svelte/store";

export type PopupButtonVariant =
  | "default"
  | "secondary"
  | "danger"
  | "outline"
  | "ghost"
  | "toggle";

export enum PopupResult {
  Keep,
  Close,
}

export type PopupButton = {
  text: string;
  variant?: PopupButtonVariant;
  onClick?: () => PopupResult;
};

export type PopupData = {
  id: number;
  title: string;
  content: string;
  buttons: PopupButton[];
  resolve: (index: number) => void;
  autoClose?: boolean | (() => boolean);
};

const popupList = writable<PopupData[]>([]);
let idCounter = 0;

function open({
  title,
  content,
  buttons,
  autoClose = false,
}: Omit<PopupData, "id" | "resolve">): Promise<number> {
  return new Promise<number>((resolve) => {
    const popup: PopupData = {
      id: ++idCounter,
      title,
      content,
      buttons,
      resolve,
      autoClose,
    };
    popupList.update((list) => [...list, popup]);

    if (typeof autoClose === "function") {
      checkAutoCloseCondition(popup.id, autoClose);
    }
  });
}

function checkAutoCloseCondition(id: number, condition: () => boolean) {
  const interval = window.setInterval(() => {
    popupList.update((list) => {
      const popup = list.find((entry) => entry.id === id);
      if (!popup) {
        window.clearInterval(interval);
        return list;
      }

      if (condition()) {
        window.clearInterval(interval);
        popup.resolve(-1);
        return list.filter((entry) => entry.id !== id);
      }

      return list;
    });
  }, 100);
}

function close(id: number) {
  popupList.update((list) => list.filter((entry) => entry.id !== id));
}

function autoClose(id: number) {
  popupList.update((list) => {
    const popup = list.find((entry) => entry.id === id);
    if (popup && popup.autoClose) {
      popup.resolve(-1);
      return list.filter((entry) => entry.id !== id);
    }
    return list;
  });
}

export const PopupStore = {
  subscribe: popupList.subscribe,
  open,
  close,
  autoClose,
};
