"use strict";

/* global browser */

const PREFS = [
  {
    name: "network.trr.mode",
    type: "int",
    value: 4
  },
  {
    name: "network.trr.uri",
    type: "string",
    value: "https://dns.cloudflare.com/.well-known/dns"
  }
];
const HAS_SEEN_PREF = "network.trr.experimentalRollout";
const HAS_SEEN_VERSION = 1;
const STORAGE_AREA = "local";

const rollout = {
  async init() {
    browser.runtime.onMessage.addListener((...args) => this.handleMessage(...args));
    await this.show();
  },

  handleMessage(message) {
    switch (message.method) {
      case "disable":
        this.disable();
        break;
    }
  },

  async getPrefs() {
    return browser.experiments.rollout.getPrefs(this.getPrefNames());
  },

  getPrefNames() {
    return PREFS.map((pref) => {
      return pref.name;
    });
  },

  enable() {
    return this.setPrefs(PREFS);
  },

  getUserPrefKey(key) {
    return `userPref_${key}`;
  },

  /**
   * Get the initial user values of the experiments preferences and store them into the extension
   */
  async storeInitialUserPrefValues() {
    const prefValues = await this.getPrefs();
    const storeValues = {};
    Object.keys(prefValues).forEach((key) => {
      const val = prefValues[key];
      if (val !== null) {
        storeValues[this.getUserPrefKey(key)] = val;
      }
    });
    return browser.storage[STORAGE_AREA].set(storeValues);
  },

  /**
   * Reset extension prefs to initial values
   */
  async resetToInitial() {
    const prefNames = this.getPrefNames();
    const storePrefNames = prefNames.map(n => {
      return this.getUserPrefKey(n);
    });
    const initialValues = await browser.storage[STORAGE_AREA].get(storePrefNames);
    /* map PREFS object to contain null / initial value which will reset to what it was pre extension */
    return this.setPrefs(PREFS.map((pref) => {
      pref.value = initialValues[this.getUserPrefKey(pref.name)] || null;
      return pref;
    }));
  },

  /**
   * Set browser preferences to prefs objects
   */
  async setPrefs(prefs) {
    return browser.experiments.rollout.setPrefs(prefs);
  },

  async disable() {
    await this.resetToInitial();
    const url = this.introUrl;
    const tabs = await browser.tabs.query({url});
    return browser.tabs.remove(tabs.map(({id}) => id));
  },

  get introUrl() {
    return browser.runtime.getURL("intro.html");
  },

  async getHasSeenPref() {
    const {[HAS_SEEN_PREF]:setupPref} = await browser.experiments.rollout.getPrefs([HAS_SEEN_PREF]);
    return setupPref;
  },

  async setHasSeenPref(value) {
    return this.setPrefs([
      {
        name: HAS_SEEN_PREF,
        value,
        type: "int"
      }
    ]);
  },

  async show() {
    const hasSeenPref = await this.getHasSeenPref();
    if (!hasSeenPref || hasSeenPref < HAS_SEEN_VERSION) {
      await this.storeInitialUserPrefValues();
      await this.enable();
      await this.setHasSeenPref(1);
      const url = this.introUrl;
      browser.tabs.create({
        url
      });
    }
  }
};

rollout.init();

