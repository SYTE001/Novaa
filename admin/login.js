const form = document.getElementById("loginForm");
const passwordInput = document.getElementById("passwordInput");
const errorText = document.getElementById("errorText");

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  errorText.hidden = true;

  const response = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ password: passwordInput.value })
  });

  if (!response.ok) {
    errorText.hidden = false;
    return;
  }

  location.href = "/admin/";
});
