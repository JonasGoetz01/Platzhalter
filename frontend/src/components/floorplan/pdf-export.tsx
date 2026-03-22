"use client"

import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  pdf,
} from "@react-pdf/renderer"
import type { Event, FloorPlanLayout, Person, Group } from "@/lib/types"
import { computeSeatsForTable, getTotalSeatCount } from "@/lib/floorplan"

const GOLD = "#c8a96e"
const NACHT = "#0d0d0f"

const styles = StyleSheet.create({
  page: {
    padding: 40,
    backgroundColor: "#ffffff",
    fontFamily: "Helvetica",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginBottom: 20,
    borderBottomWidth: 2,
    borderBottomColor: GOLD,
    paddingBottom: 12,
  },
  title: {
    fontSize: 24,
    fontFamily: "Helvetica-Bold",
    color: NACHT,
  },
  subtitle: {
    fontSize: 10,
    color: "#666",
    marginTop: 4,
  },
  brand: {
    fontSize: 8,
    color: GOLD,
    fontFamily: "Helvetica-Bold",
    letterSpacing: 2,
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    color: NACHT,
    marginBottom: 8,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  table: {
    marginBottom: 12,
  },
  tableName: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    color: NACHT,
    backgroundColor: "#f5f5f5",
    padding: 6,
    borderRadius: 3,
    marginBottom: 4,
  },
  seatRow: {
    flexDirection: "row",
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: "#eee",
  },
  seatLabel: {
    width: 40,
    fontSize: 9,
    color: "#999",
  },
  personName: {
    flex: 1,
    fontSize: 10,
    color: NACHT,
  },
  groupName: {
    fontSize: 8,
    color: GOLD,
  },
  emptyText: {
    fontSize: 9,
    color: "#ccc",
    fontStyle: "italic",
  },
  statsRow: {
    flexDirection: "row",
    gap: 20,
    marginBottom: 16,
  },
  statBox: {
    padding: 8,
    backgroundColor: "#f8f8f8",
    borderRadius: 4,
    minWidth: 80,
  },
  statValue: {
    fontSize: 18,
    fontFamily: "Helvetica-Bold",
    color: NACHT,
  },
  statLabel: {
    fontSize: 8,
    color: "#999",
    marginTop: 2,
  },
  unassignedSection: {
    marginTop: 16,
  },
  unassignedList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  unassignedItem: {
    fontSize: 9,
    color: "#666",
    backgroundColor: "#f5f5f5",
    padding: "3 8",
    borderRadius: 3,
  },
  footer: {
    position: "absolute",
    bottom: 30,
    left: 40,
    right: 40,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 7,
    color: "#999",
  },
})

interface PDFDocumentProps {
  event: Event
  layout: FloorPlanLayout
  persons: Person[]
  groups: Group[]
}

function SeatingPlanDocument({
  event,
  layout,
  persons,
  groups,
}: PDFDocumentProps) {
  const groupMap = new Map(groups.map((g) => [g.id, g]))
  const personByTableSeat = new Map<string, Person>()
  const unassigned: Person[] = []

  for (const p of persons) {
    if (p.table_ref && p.seat_ref) {
      personByTableSeat.set(`${p.table_ref}:${p.seat_ref}`, p)
    } else {
      unassigned.push(p)
    }
  }

  const seated = persons.length - unassigned.length

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>{event.name}</Text>
            {event.event_date && (
              <Text style={styles.subtitle}>
                {new Date(event.event_date).toLocaleDateString("de-DE", {
                  weekday: "long",
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </Text>
            )}
          </View>
          <Text style={styles.brand}>PLATZHALTER</Text>
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{persons.length}</Text>
            <Text style={styles.statLabel}>Gäste gesamt</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{seated}</Text>
            <Text style={styles.statLabel}>Platziert</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{layout.tables.length}</Text>
            <Text style={styles.statLabel}>Tische</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{unassigned.length}</Text>
            <Text style={styles.statLabel}>Nicht platziert</Text>
          </View>
        </View>

        {/* Tables — now using computed seats */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Tischübersicht</Text>
          {layout.tables.map((table) => {
            const seats = computeSeatsForTable(table)
            return (
              <View key={table.id} style={styles.table}>
                <Text style={styles.tableName}>
                  {table.label} ({getTotalSeatCount(table)} Plätze)
                </Text>
                {seats.map((seat) => {
                  const person = personByTableSeat.get(
                    `${table.id}:${seat.seatRef}`
                  )
                  const group = person?.group_id
                    ? groupMap.get(person.group_id)
                    : null

                  return (
                    <View key={seat.id} style={styles.seatRow}>
                      <Text style={styles.seatLabel}>
                        Platz {seat.label}
                      </Text>
                      {person ? (
                        <View style={{ flex: 1 }}>
                          <Text style={styles.personName}>
                            {person.name}
                          </Text>
                          {group && (
                            <Text style={styles.groupName}>
                              {group.name}
                            </Text>
                          )}
                        </View>
                      ) : (
                        <Text style={styles.emptyText}>— frei —</Text>
                      )}
                    </View>
                  )
                })}
              </View>
            )
          })}
        </View>

        {/* Unassigned */}
        {unassigned.length > 0 && (
          <View style={styles.unassignedSection}>
            <Text style={styles.sectionTitle}>
              Nicht platziert ({unassigned.length})
            </Text>
            <View style={styles.unassignedList}>
              {unassigned.map((p) => (
                <Text key={p.id} style={styles.unassignedItem}>
                  {p.name}
                </Text>
              ))}
            </View>
          </View>
        )}

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text>
            Erstellt am{" "}
            {new Date().toLocaleDateString("de-DE", {
              year: "numeric",
              month: "long",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </Text>
          <Text>Platzhalter — Sitzplan-Verwaltung</Text>
        </View>
      </Page>
    </Document>
  )
}

export async function generateSeatingPDF(
  event: Event,
  layout: FloorPlanLayout,
  persons: Person[],
  groups: Group[]
): Promise<Blob> {
  const doc = (
    <SeatingPlanDocument
      event={event}
      layout={layout}
      persons={persons}
      groups={groups}
    />
  )
  return pdf(doc).toBlob()
}
