import { defineStore } from 'pinia';

export const useAuthStore = defineStore('auth', {
  state: () => ({
    isLoggedIn: false,
    user: null
  }),
  actions: {
    setAuth(auth) {
      this.isLoggedIn = auth?.isLoggedIn ?? false;
      this.user = auth?.user ?? null;
    },
    clear() {
      this.isLoggedIn = false;
      this.user = null;
    }
  }
});
