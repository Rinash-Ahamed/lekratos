"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useState } from "react";
import type { CartLine, Size } from "./types";

interface State {
  cart: CartLine[];
  wishlist: string[]; // product ids
  hydrated: boolean;
}

type Action =
  | { type: "hydrate"; cart: CartLine[]; wishlist: string[] }
  | { type: "add"; line: CartLine }
  | { type: "qty"; productId: string; color: string; size: Size; qty: number }
  | { type: "remove"; productId: string; color: string; size: Size }
  | { type: "clear" }
  | { type: "wish"; id: string };

const same = (a: CartLine, id: string, color: string, size: Size) =>
  a.productId === id && a.color === color && a.size === size;

function reducer(s: State, a: Action): State {
  switch (a.type) {
    case "hydrate":
      return { cart: a.cart, wishlist: a.wishlist, hydrated: true };
    case "add": {
      const hit = s.cart.find((l) => same(l, a.line.productId, a.line.color, a.line.size));
      const cart = hit
        ? s.cart.map((l) => (l === hit ? { ...l, qty: Math.min(10, l.qty + a.line.qty) } : l))
        : [...s.cart, a.line];
      return { ...s, cart };
    }
    case "qty":
      return {
        ...s,
        cart: s.cart
          .map((l) => (same(l, a.productId, a.color, a.size) ? { ...l, qty: Math.max(1, Math.min(10, a.qty)) } : l)),
      };
    case "remove":
      return { ...s, cart: s.cart.filter((l) => !same(l, a.productId, a.color, a.size)) };
    case "clear":
      return { ...s, cart: [] };
    case "wish":
      return {
        ...s,
        wishlist: s.wishlist.includes(a.id) ? s.wishlist.filter((i) => i !== a.id) : [...s.wishlist, a.id],
      };
  }
}

interface Ctx {
  cart: CartLine[];
  wishlist: string[];
  count: number;
  subtotal: number;
  cartOpen: boolean;
  setCartOpen: (v: boolean) => void;
  add: (line: CartLine, openDrawer?: boolean) => void;
  setQty: (l: CartLine, qty: number) => void;
  remove: (l: CartLine) => void;
  clear: () => void;
  toggleWish: (id: string) => void;
  hydrated: boolean;
}

const StoreCtx = createContext<Ctx | null>(null);
const KEY = "lekratos:store:v1";

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, { cart: [], wishlist: [], hydrated: false });
  const [cartOpen, setCartOpen] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      const parsed = raw ? JSON.parse(raw) : {};
      dispatch({ type: "hydrate", cart: parsed.cart ?? [], wishlist: parsed.wishlist ?? [] });
    } catch {
      dispatch({ type: "hydrate", cart: [], wishlist: [] });
    }
  }, []);

  useEffect(() => {
    if (!state.hydrated) return;
    try {
      localStorage.setItem(KEY, JSON.stringify({ cart: state.cart, wishlist: state.wishlist }));
    } catch { /* storage blocked: bag works for this visit only */ }
  }, [state.cart, state.wishlist, state.hydrated]);

  const add = useCallback((line: CartLine, openDrawer = true) => {
    dispatch({ type: "add", line });
    if (openDrawer) setCartOpen(true);
  }, []);

  const value = useMemo<Ctx>(
    () => ({
      cart: state.cart,
      wishlist: state.wishlist,
      count: state.cart.reduce((n, l) => n + l.qty, 0),
      subtotal: state.cart.reduce((n, l) => n + l.qty * l.price, 0),
      cartOpen,
      setCartOpen,
      add,
      setQty: (l, qty) => dispatch({ type: "qty", productId: l.productId, color: l.color, size: l.size, qty }),
      remove: (l) => dispatch({ type: "remove", productId: l.productId, color: l.color, size: l.size }),
      clear: () => dispatch({ type: "clear" }),
      toggleWish: (id) => dispatch({ type: "wish", id }),
      hydrated: state.hydrated,
    }),
    [state, cartOpen, add],
  );

  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>;
}

export function useStore() {
  const c = useContext(StoreCtx);
  if (!c) throw new Error("useStore must be used inside StoreProvider");
  return c;
}
