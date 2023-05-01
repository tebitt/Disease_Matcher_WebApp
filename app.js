const form = document.getElementById('myForm');

form.addEventListener('submit', (event) => {
  event.preventDefault();

  const checkboxes = document.querySelectorAll('input[name="symptoms"]:checked');
  const symptoms = Array.from(checkboxes).map((checkbox) => checkbox.value);

  fetch('/submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ symptoms })
  })
  .then(response => response.text())
  .then(html => {
    document.open();
    document.write(html);
    document.close();
  })
  .catch(error => console.error(error));
});
