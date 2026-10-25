type Props = { className?: string }

export default function CarArtwork({ className = '' }: Props) {
  return (
    <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 620 290" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="311" cy="250" fill="#000" opacity=".22" rx="250" ry="18" />
      <path d="M78 182c18-6 38-10 70-13l52-62c12-14 27-21 48-22h164c21 0 38 9 52 23l47 51 48 11c20 5 31 18 31 36v24H52v-25c0-10 9-19 26-23Z" fill="#d9dee0" />
      <path d="m208 164 41-50c6-7 13-10 23-10h132c12 0 22 4 29 12l38 48H208Z" fill="#242b2c" />
      <path d="M334 106v57M88 187h479" stroke="#fff" strokeOpacity=".6" strokeWidth="3" />
      <path d="M56 198h42l-7 14H53m538-14h-42l7 14h36" fill="#f7b84d" />
      <path d="M181 165h310" stroke="#a5afb1" strokeWidth="3" />
      <path d="M47 230h548v10c0 8-6 14-14 14H61c-8 0-14-6-14-14v-10Z" fill="#aeb8bb" />
      <circle cx="170" cy="231" fill="#1a2021" r="40" />
      <circle cx="170" cy="231" fill="#d8ddde" r="19" />
      <circle cx="475" cy="231" fill="#1a2021" r="40" />
      <circle cx="475" cy="231" fill="#d8ddde" r="19" />
    </svg>
  )
}
