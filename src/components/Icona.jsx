import {
  Archive, ArrowDown, ArrowUp, BadgePlus, Ban, Banknote, Bell, BellOff, BellRing, BookOpen, Calculator, Calendar,
  CalendarDays, ChartColumn, ChefHat, Circle, CircleCheck, CircleHelp, CircleX, ClipboardList,
  Clock, Coins, Columns3, ConciergeBell, CreditCard, Crown, Divide, Download, Eraser, Eye, EyeOff,
  Factory, FileText, Flame, FlaskConical, Folder, Funnel, Gift, GlassWater, Globe, Hand, HandHeart,
  HandPlatter, Handshake, Hourglass, Image, Inbox, Info, KeyRound, Landmark, Layers, LayoutGrid,
  Lightbulb, Link, List, Lock, LogOut, Mail, MapPin, Martini, Maximize, Menu, MessageSquare,
  Minimize, Nfc, NotebookText, OctagonX, Package, Palette, Paperclip, PartyPopper, Pause, PenTool,
  Pencil, PersonStanding, Play, Plus, Printer, Puzzle, ReceiptText, RefreshCw, RotateCcw, Save,
  Scale, Scissors, ScrollText, Search, Settings, ShoppingBag, ShoppingCart, SlidersHorizontal,
  SlidersVertical, Smartphone, SmartphoneNfc, Sparkles, Split, SquareCheck, SquarePen, Star, StickyNote,
  Tag, Ticket, Timer, Trash2, TrendingUp, TriangleAlert, Trophy, Upload, User, UserCog, Users,
  UtensilsCrossed, Wallet, Wifi, WifiOff, Wine, Wrench, X,
} from 'lucide-react'
import { VOCABOLARIO, nomeIcona, dividiIcona, GRUPPO_DI_PARTENZA } from '../lib/icone.js'
import { useTemaIcone } from '../lib/temaIcone.js'

// ── UN'ICONA DEL GESTIONALE, NEL TEMA DEL LOCALE (REQ-UI-031) ──────────
//
// `<Icona nome="cassa" />`: il nome è del vocabolario (lib/icone.js), il
// disegno lo sceglie il tema. «Silhouette» disegna Lucide a tratto, nel
// colore del testo attorno (currentColor) e alla sua misura (em): così un
// tasto, una voce di menu e un titolo hanno icone della stessa taglia e
// dello stesso peso — Flavio, 07/11/2026, sulle emoji «di dimensioni
// differenti». «Emoji» rimette quelle di prima.
//
// Si possono passare anche le emoji vecchie: `nomeIcona` le riporta al loro
// nome, e le schermate non ancora passate al vocabolario si vedono già nel
// tema. Un testo che non è un'icona conosciuta esce così com'è: meglio
// un'emoji fuori tema che un buco.
//
// Le icone sono decorative (aria-hidden): accanto c'è sempre la parola, e
// la parola è quella che si legge — anche con lo screen reader. Dove
// l'icona è da sola (un tasto senza testo) il nome per l'accessibilità va
// sul tasto, come prima.

// Importati uno per uno: con «import *» il pacchetto finirebbe intero nel
// bundle. Una prova (tests/unit/icone.test.js) controlla che ci siano
// tutti quelli del vocabolario.
const DISEGNI = {
  Archive, ArrowDown, ArrowUp, BadgePlus, Ban, Banknote, Bell, BellOff, BellRing, BookOpen, Calculator, Calendar,
  CalendarDays, ChartColumn, ChefHat, Circle, CircleCheck, CircleHelp, CircleX, ClipboardList,
  Clock, Coins, Columns3, ConciergeBell, CreditCard, Crown, Divide, Download, Eraser, Eye, EyeOff,
  Factory, FileText, Flame, FlaskConical, Folder, Funnel, Gift, GlassWater, Globe, Hand, HandHeart,
  HandPlatter, Handshake, Hourglass, Image, Inbox, Info, KeyRound, Landmark, Layers, LayoutGrid,
  Lightbulb, Link, List, Lock, LogOut, Mail, MapPin, Martini, Maximize, Menu, MessageSquare,
  Minimize, Nfc, NotebookText, OctagonX, Package, Palette, Paperclip, PartyPopper, Pause, PenTool,
  Pencil, PersonStanding, Play, Plus, Printer, Puzzle, ReceiptText, RefreshCw, RotateCcw, Save,
  Scale, Scissors, ScrollText, Search, Settings, ShoppingBag, ShoppingCart, SlidersHorizontal,
  SlidersVertical, Smartphone, SmartphoneNfc, Sparkles, Split, SquareCheck, SquarePen, Star, StickyNote,
  Tag, Ticket, Timer, Trash2, TrendingUp, TriangleAlert, Trophy, Upload, User, UserCog, Users,
  UtensilsCrossed, Wallet, Wifi, WifiOff, Wine, Wrench, X,
}

export default function Icona({ nome, gruppo = GRUPPO_DI_PARTENZA, size = '1.1em', className = '' }) {
  const tema = useTemaIcone(gruppo)
  const chiave = nomeIcona(nome)
  if (!chiave) return nome ? <span aria-hidden="true">{nome}</span> : null
  const voce = VOCABOLARIO[chiave]
  // I PALLINI SONO UN COLORE (verde, giallo, rosso degli stati): restano
  // colorati anche in Silhouette, con gli inchiostri di stato del tema.
  if (voce.colore) {
    return <span aria-hidden="true" className={`icona-pallino icona-pallino-${voce.colore} ${className}`.trim()} />
  }
  if (tema === 'emoji') return <span aria-hidden="true" className={className || undefined}>{voce.emoji}</span>
  const Disegno = DISEGNI[voce.disegno]
  return <Disegno aria-hidden="true" className={`icona ${className}`.trim()} size={size} strokeWidth={2} />
}

// UN'ETICHETTA CHE ARRIVA COME TESTO, con l'emoji davanti («🧾 Da fare»,
// lib/icone.js conEmoji): l'icona si disegna nel tema, il resto è testo.
// Un testo senza un'emoji conosciuta in testa esce com'è. Con `nome`
// l'icona è quella, e `testo` è tutto testo.
export function ConIcona({ testo, nome, gruppo = 'tasti' }) {
  const diviso = nome ? { nome, resto: testo } : dividiIcona(testo)
  if (!diviso) return testo ?? null
  return (
    <>
      <Icona nome={diviso.nome} gruppo={gruppo} /> {diviso.resto}
    </>
  )
}
