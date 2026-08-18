import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

type typeUser = "customer" | "admin";

interface SessionUser {
  id: string;
  email: string;
  name: string;
  type: typeUser;
}

interface UserState {
  user: SessionUser | null;
  userHasHydrated: boolean;
  setUserHasHydrated: (state: boolean) => void;
  signIn: (data: { user: SessionUser }) => void;
  signOut: () => void;
}

export const useUserStore = create<UserState>()(
  persist(
    (set) => ({
      user: null,
      userHasHydrated: false,

      setUserHasHydrated: (state) => {
        set({ userHasHydrated: state });
      },

      signIn: ({ user }) => {
        set({ user });
      },

      signOut: () => {
        set({ user: null });
      },
    }),
    {
      name: "session_user",
      storage: createJSONStorage(() => localStorage),
      onRehydrateStorage: () => (state) => {
        state?.setUserHasHydrated(true);
      },
    }
  )
);

// Hook auxiliar para facilitar o uso
export const useUserHasHydrated = () =>
  useUserStore((state) => state.userHasHydrated);
