import { Title } from "@solidjs/meta";
import AuthGate from "../components/AuthGate.tsrx";
import logo from "../logo.svg";

export default function Home() @{
  <main>
    <Title>Doit - Todos</Title>
    <img src={logo} class="logo" alt="Solid logo" />
    <h1>Doit</h1>
    <p class="intro">A simple todo list, saved to your Turso database.</p>
    <AuthGate />
  </main>;
}
