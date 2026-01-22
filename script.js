const themeButtons = document.querySelectorAll(".themeToggle")

if (localStorage.getItem("theme") === "dark") {
  document.body.classList.add("dark")
}

themeButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    document.body.classList.toggle("dark")
    const isDark = document.body.classList.contains("dark")
    localStorage.setItem("theme", isDark ? "dark" : "light")
  })
})