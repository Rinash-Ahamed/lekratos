"use client";

import { createContext, useContext } from "react";
import type { PublicConfig } from "./format";

const Ctx = createContext<PublicConfig>({ flatRate: 0 });
export const ConfigProvider = Ctx.Provider;
export const useConfig = () => useContext(Ctx);
