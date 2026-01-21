const themeButton = document.getElementById("themeToggle")

if (localStorage.getItem("theme") === "dark") {
  document.body.classList.add("dark")
}

themeButton.addEventListener("click", () => {
    document.body.classList.toggle("dark")
    const isDark = document.body.classList.contains("dark")
    localStorage.setItem("theme", isDark ? "dark" : "light")
})