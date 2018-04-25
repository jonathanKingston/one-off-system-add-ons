"use strict";

/* global Components, ExtensionAPI */
let Cc = Components.classes;
let Cu = Components.utils;
let Ci = Components.interfaces;
Cu.import("resource://gre/modules/Services.jsm");

const {EventManager} = ExtensionCommon;

const ToolkitModules = {};

// Implements an experimental extension to the notifications api

Cu.import("resource://gre/modules/EventEmitter.jsm");

class NotificationPrompt {
  constructor(extension, notificationsMap, id, options) {
    this.notificationsMap = notificationsMap;
    this.id = id;
    this.options = options;

    const browserWin = Services.wm.getMostRecentWindow("navigator:browser");
    let buttonsOutput = [];
    if (options.buttons) {
      let buttonIndex = 0;
      for (let buttonIndex in options.buttons) {
        let button = options.buttons[buttonIndex];
        buttonsOutput.push({
          label: button.title,
          callback: () => {
            this.handleEvent("buttonClicked", {
              notificationId: id,
              buttonIndex
            });
          }
        });
      }
    }
    this.box = browserWin.document.getElementById("global-notificationbox");
    this.box.appendNotification(options.message, id, null, this.box.PRIORITY_INFO_HIGH,
      buttonsOutput);
  }

  clear() {
    this.box.getNotificationWithValue(this.id).close();
    this.notificationsMap.delete(this.id);
  }

  handleEvent(event, data) {
    this.notificationsMap.emit(event, data);
  }
}

var notifications = class notifications extends ExtensionAPI {
  constructor(extension) {
    super(extension);

    this.nextId = 0;
    this.notificationsMap = new Map();
    EventEmitter.decorate(this.notificationsMap);
  }

  onShutdown() {
    for (let notification of this.notificationsMap.values()) {
      notification.clear();
    }
  }

  getAPI(context) {
    let {extension} = context;
    let notificationsMap = this.notificationsMap;

    return {
      experiments: {
        notifications: {
          create: (notificationId, options) => {
            if (!notificationId) {
              notificationId = String(this.nextId++);
            }
  
            if (notificationsMap.has(notificationId)) {
              notificationsMap.get(notificationId).clear();
            }
  
            let notification;
            if (options.type === "prompt") {
              notification = new NotificationPrompt(extension, notificationsMap, notificationId, options);
            } else {
             // Normal notices here unsupported in experiment
            }
            notificationsMap.set(notificationId, notification);
  
            return Promise.resolve(notificationId);
          },
  
          onButtonClicked: new EventManager(
            context,
            "notifications.onButtonClicked",
            fire => {
              let listener = (event, data) => {
                fire.async(data);
              };
  
              notificationsMap.on("buttonClicked", listener);
              return () => {
                notificationsMap.off("buttonClicked", listener);
              };
            },
          ).api(),
        },
      },
    };
  }
};
