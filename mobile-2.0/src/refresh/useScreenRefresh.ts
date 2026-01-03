import { useEffect } from "react";
import { useIsFocused } from "@react-navigation/native";
import { useRefreshRegistry } from "./RefreshRegistry";

type RefreshFn = () => Promise<void> | void;

export function useScreenRefresh(loadData: RefreshFn) {
  const isFocused = useIsFocused();
  const { register } = useRefreshRegistry();

  useEffect(() => {
    if (!isFocused) return;

    register(loadData);

    return () => {
      register(null);
    };
  }, [isFocused, loadData, register]);
}
