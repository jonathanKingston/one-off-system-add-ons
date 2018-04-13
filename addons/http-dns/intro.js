const disableButton = document.getElementById("disable");
disableButton.addEventListener("submit", (e) => {
  e.preventDefault();
  browser.runtime.sendMessage({
    method: "disable"
  });
});
