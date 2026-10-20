import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const config = window.HEARTH_CONFIG || {};
const configured = Boolean(config.supabaseUrl && config.supabaseAnonKey);
const supabase = configured
  ? createClient(config.supabaseUrl, config.supabaseAnonKey, {
      auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: true },
    })
  : null;
const state = { session: null, models: [], authMode: "signin" };
const $ = (selector) => document.querySelector(selector);

function escapeHTML(value = "") {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[char]);
}

function safeModelURL(value) {
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "https:" || parsed.username || parsed.password) return null;
    return parsed;
  } catch {
    return null;
  }
}

function toast(message) {
  const element = $("#toast");
  element.textContent = message;
  element.classList.remove("hidden");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => element.classList.add("hidden"), 4000);
}

function showError(selector, message) {
  const element = $(selector);
  element.textContent = message;
  element.classList.remove("hidden");
}

function setAccount(session) {
  state.session = session;
  $("#sign-in-open").classList.toggle("hidden", Boolean(session));
  $("#sign-out").classList.toggle("hidden", !session);
  $("#submit-open").textContent = session ? "＋ Submit a model" : "＋ Sign in to submit";
}

function openAuth(mode = "signin") {
  if (!supabase) {
    $("#config-warning").classList.remove("hidden");
    $("#config-warning").scrollIntoView({ behavior: "smooth", block: "center" });
    toast("Connect a free Supabase project to enable accounts.");
    return;
  }
  setAuthMode(mode);
  $("#auth-modal").classList.remove("hidden");
  $("#auth-email").focus();
}

function setAuthMode(mode) {
  state.authMode = mode;
  const signup = mode === "signup";
  $("#auth-title").innerHTML = signup ? "Join the community<span>.</span>" : "Welcome back<span>.</span>";
  $("#auth-description").textContent = signup
    ? "Create a free account to share model links."
    : "Sign in to share model links with the community.";
  $("#auth-password").autocomplete = signup ? "new-password" : "current-password";
  $("#auth-submit").innerHTML = signup ? 'Create account <span>→</span>' : 'Sign in <span>→</span>';
  $("#auth-switch").innerHTML = signup
    ? 'Already have an account? <button type="button" id="auth-toggle">Sign in</button>'
    : 'New to Hearth? <button type="button" id="auth-toggle">Create an account</button>';
  $("#auth-error").classList.add("hidden");
}

function openSubmit() {
  if (!state.session) {
    openAuth("signup");
    return;
  }
  $("#submit-error").classList.add("hidden");
  $("#submit-modal").classList.remove("hidden");
  $("#model-name").focus();
}

function formatDate(value) {
  return new Intl.DateTimeFormat("en", { year: "numeric", month: "short", day: "numeric" }).format(new Date(value));
}

function renderCatalog() {
  const query = $("#search").value.trim().toLowerCase();
  const category = $("#category-filter").value;
  const sort = $("#sort-filter").value;
  const filtered = state.models.filter((model) => {
    const searchable = [model.name, model.category, model.quantization, model.license, model.description].join(" ").toLowerCase();
    return (!query || searchable.includes(query)) && (!category || model.category === category);
  });
  if (sort === "name") filtered.sort((a, b) => a.name.localeCompare(b.name));
  if (sort === "oldest") filtered.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  if (sort === "newest") filtered.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  $("#result-count").textContent = `${filtered.length} ${filtered.length === 1 ? "model" : "models"}`;
  $("#empty-state").classList.toggle("hidden", filtered.length > 0);
  $("#catalog-grid").innerHTML = filtered.map((model) => {
    const modelURL = safeModelURL(model.model_url);
    if (!modelURL) return "";
    const owned = state.session?.user?.id === model.user_id;
    return `<article class="model-card">
      <div class="card-top"><span class="category-icon">${categoryIcon(model.category)}</span><span class="category-tag">${escapeHTML(model.category)}</span>${model.quantization ? `<span class="quant-tag">${escapeHTML(model.quantization)}</span>` : ""}</div>
      <h3>${escapeHTML(model.name)}</h3>
      <p class="card-description">${escapeHTML(model.description)}</p>
      <div class="card-license"><span>LICENSE</span><strong>${escapeHTML(model.license)}</strong></div>
      <div class="card-footer"><span>Added ${escapeHTML(formatDate(model.created_at))}</span>${owned ? `<button class="delete-link" data-delete="${escapeHTML(model.id)}" aria-label="Delete your listing">Delete</button>` : ""}</div>
      <a class="model-link" href="${escapeHTML(modelURL.href)}" target="_blank" rel="noopener noreferrer">View original model <span>↗</span></a>
    </article>`;
  }).join("");
}

function categoryIcon(category) {
  return ({ Chat: "✳", Code: "⌘", Vision: "◉", Embeddings: "⠿", Audio: "♫", Other: "✦" })[category] || "✳";
}

async function loadCatalog() {
  if (!supabase) {
    $("#result-count").textContent = "Supabase setup required";
    $("#catalog-grid").innerHTML = "";
    $("#empty-state").classList.add("hidden");
    return;
  }
  $("#load-error").classList.add("hidden");
  const { data, error } = await supabase
    .from("model_links")
    .select("id,user_id,name,category,quantization,model_url,license,description,created_at")
    .order("created_at", { ascending: false });
  if (error) {
    $("#result-count").textContent = "Could not load the directory";
    showError("#load-error", `${error.message} If this is a new project, run supabase/schema.sql as described in README.md.`);
    return;
  }
  state.models = data || [];
  renderCatalog();
}

async function submitModel(event) {
  event.preventDefault();
  if (!state.session) {
    $("#submit-modal").classList.add("hidden");
    openAuth("signup");
    return;
  }
  const input = {
    name: $("#model-name").value.trim(),
    category: $("#model-category").value,
    quantization: $("#model-quant").value.trim(),
    model_url: $("#model-url").value.trim(),
    license: $("#model-license").value.trim(),
    description: $("#model-description").value.trim(),
  };
  const parsed = safeModelURL(input.model_url);
  if (!parsed) {
    showError("#submit-error", "Enter a valid public HTTPS link. Private credentials and non-HTTPS links are not accepted.");
    return;
  }
  if (input.name.length < 2 || input.description.length < 5) {
    showError("#submit-error", "Add a model name and a description with at least 5 characters.");
    return;
  }
  const button = $("#submit-button");
  button.disabled = true;
  button.textContent = "Submitting…";
  $("#submit-error").classList.add("hidden");
  const { error } = await supabase.from("model_links").insert(input);
  button.disabled = false;
  button.innerHTML = 'Share model link <span>→</span>';
  if (error) {
    showError("#submit-error", error.message);
    return;
  }
  $("#submit-form").reset();
  $("#submit-modal").classList.add("hidden");
  toast("Model link added to the community directory.");
  await loadCatalog();
}

async function authenticate(event) {
  event.preventDefault();
  const button = $("#auth-submit");
  const email = $("#auth-email").value.trim();
  const password = $("#auth-password").value;
  const signup = state.authMode === "signup";
  button.disabled = true;
  button.textContent = signup ? "Creating account…" : "Signing in…";
  $("#auth-error").classList.add("hidden");
  const { data, error } = signup
    ? await supabase.auth.signUp({ email, password, options: { emailRedirectTo: location.origin + location.pathname } })
    : await supabase.auth.signInWithPassword({ email, password });
  button.disabled = false;
  if (error) {
    showError("#auth-error", error.message);
    $("#auth-submit").innerHTML = signup ? 'Create account <span>→</span>' : 'Sign in <span>→</span>';
    return;
  }
  if (signup && !data.session) {
    $("#auth-description").textContent = "Check your inbox for a confirmation link, then come back and sign in.";
    toast("Check your email to confirm your account.");
    return;
  }
  setAccount(data.session);
  $("#auth-modal").classList.add("hidden");
  toast(signup ? "Your account is ready. You can now submit a model link." : "You are signed in.");
}

async function deleteListing(id) {
  const model = state.models.find((item) => item.id === id);
  if (!model || model.user_id !== state.session?.user?.id) return;
  if (!window.confirm(`Delete your listing for "${model.name}"? The original model file will not be affected.`)) return;
  const { error } = await supabase.from("model_links").delete().eq("id", id);
  if (error) {
    toast(`Could not delete listing: ${error.message}`);
    return;
  }
  toast("Your listing was deleted.");
  await loadCatalog();
}

$("#sign-in-open").addEventListener("click", () => openAuth("signin"));
$("#sign-out").addEventListener("click", async () => {
  const { error } = await supabase.auth.signOut();
  if (error) { toast(error.message); return; }
  setAccount(null);
  renderCatalog();
  toast("You have signed out.");
});
$("#submit-open").addEventListener("click", openSubmit);
$("#hero-submit").addEventListener("click", openSubmit);
$("#empty-submit").addEventListener("click", openSubmit);
$("#auth-form").addEventListener("submit", authenticate);
$("#submit-form").addEventListener("submit", submitModel);
$("#auth-toggle").addEventListener("click", () => setAuthMode(state.authMode === "signin" ? "signup" : "signin"));
$("#catalog-grid").addEventListener("click", (event) => {
  const button = event.target.closest("[data-delete]");
  if (button) deleteListing(button.dataset.delete);
});
$("#search").addEventListener("input", renderCatalog);
$("#category-filter").addEventListener("change", renderCatalog);
$("#sort-filter").addEventListener("change", renderCatalog);
document.querySelectorAll("[data-close]").forEach((button) => button.addEventListener("click", () => {
  $(`#${button.dataset.close}`).classList.add("hidden");
}));
document.querySelectorAll(".modal-backdrop").forEach((backdrop) => backdrop.addEventListener("click", (event) => {
  if (event.target === backdrop) backdrop.classList.add("hidden");
}));
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") document.querySelectorAll(".modal-backdrop").forEach((modal) => modal.classList.add("hidden"));
});

if (!configured) {
  $("#config-warning").classList.remove("hidden");
} else {
  const { data: { session } } = await supabase.auth.getSession();
  setAccount(session);
  supabase.auth.onAuthStateChange((_event, nextSession) => {
    setAccount(nextSession);
    renderCatalog();
  });
  await loadCatalog();
}
