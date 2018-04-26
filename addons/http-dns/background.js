"use strict";

/* global browser */
const HAS_SEEN_VERSION = 1;
const STORAGE_AREA = "local";

const stateManager = {
  hasInit: false,

  async init() {
    if (!this.hasInit) {
      const statesFile = browser.runtime.getURL("states.json");
      const response = await fetch(statesFile);
      this.statesInfo = await response.json();
      this.hasInit = true;
    }
  },

  async getPrefs(prefNames) {
    return browser.experiments.rollout.getPrefs(prefNames);
  },

  async getPref(prefName) {
    const {[prefName]: prefValue} = await this.getPrefs([prefName]);
    return prefValue;
  },

  async getStateName() {
    await this.init();
    let currentState = null;
    const prefValue = await this.getStatePrefValue();
    Object.keys(this.statesInfo.states).forEach((stateKey) => {
      const state = this.statesInfo.states[stateKey];
      if (state.id === prefValue) {
        currentState = stateKey;
      }
    });
    return currentState;
  },

  async getStatePrefValue() {
    await this.init();
    return this.getPref(this.statesInfo.statePref);
  },

  async setPrefs(prefs) {
    return browser.experiments.rollout.setPrefs(prefs);
  },

  async setState(stateKey) {
    await this.init();
    const prefs = [];
    const state = this.statesInfo.states[stateKey];
    state.prefs[this.statesInfo.statePref] = state.id;
    const initial = await this.getIntialPrefValues();
    const prefNames = await this.getPrefNames();
    prefNames.forEach((prefName) => {
      const value = state.prefs[prefName] || initial[prefName] || null;
      const pref = {
        name: prefName,
        value,
        type: this.statesInfo.prefTypes[prefName]
      };
      prefs.push(pref);
    });
    return this.setPrefs(prefs);
  },

  getUserPrefKey(key) {
    return `userPref_${key}`;
  },

  async getPrefNames() {
    await this.init();
    return Object.keys(this.statesInfo.prefTypes);
  },

  async getIntialPrefValues() {
    const prefNames = await this.getPrefNames();
    const storePrefNames = prefNames.map(n => {
      return this.getUserPrefKey(n);
    });
    const initialStoredValues = await browser.storage[STORAGE_AREA].get(storePrefNames);
    const initialValues = {};
    prefNames.forEach(prefName => {
      initialValues[prefName] = initialStoredValues[this.getUserPrefKey(prefName)];
    });
    return initialValues;
  },

  /**
   * Get the initial user values of the experiments preferences and store them into the extension
   */
  async setInitialUserPrefValues() {
    const prefNames = await this.getPrefNames();
    const prefValues = await this.getPrefs(prefNames);
    const storeValues = {};
    Object.keys(prefValues).forEach((key) => {
      storeValues[this.getUserPrefKey(key)] = prefValues[key];
    });
    return browser.storage[STORAGE_AREA].set(storeValues);
  },
};

const rollout = {
  async init() {
    browser.runtime.onMessage.addListener((...args) => this.handleMessage(...args));
    const stateName = await stateManager.getStateName();
    switch (stateName) {
      case null:
      case "loaded":
        await stateManager.setInitialUserPrefValues();
        await stateManager.setState("loaded");
        await this.show();
        break;
      case "enabled":
      case "disabled":
        break
    }
  },

  async disable() {
    await stateManager.setState("disabled");
  },

  async show() {
    await stateManager.setState("enabled");
    let notificationMessage = "Mozilla is working to improve privacy and security on the web. We are conducting studies that send encrypted DNS requests to Cloudflare, a secure, cloud-based service.";
    let buttons = [
      {
        label: "Disable DNS Studies",
        callbackId: "disable"
      },
      {
        label: "Ok, Got It",
        callbackId: "ok"
      },
    ];
    browser.experiments.notifications.onButtonClicked.addListener((options) => {
      switch (Number(options.buttonIndex)) {
        case 1:
          console.log("ok");
          break;
        case 0:
          this.disable();
          break;
      }
    });
    browser.experiments.notifications.create("rollout-prompt", {
      type: "prompt",
      title: "",
      message: notificationMessage,
      buttons: [
        {title: "Disable DNS Studies"},
        {title: "Ok, Got It"}
      ],
      moreInfo: {
        url: "http://mozilla.org",
        title: "Learn More"
      }
    });
  }
};

rollout.init();
