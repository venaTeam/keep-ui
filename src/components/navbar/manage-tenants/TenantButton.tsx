import { useState } from "react";
import styles from "../Search.module.css";
import TenantFormModal from "./TenantFormModal";
import { Button } from "@/components/ui";

interface TenantButtonProps {
    icon: any;
    modalType: string;
    tenantData?: any;
}

export default function TenantButton({icon, modalType, tenantData}: TenantButtonProps) {

    const [openModal, setOpenModal] = useState(false);

  return (
    <>
    <Button icon={icon} className={styles.createUpdateTenant} onClick={() => setOpenModal(true)} variant={undefined} />
    {openModal && <TenantFormModal modalType={modalType} openModal={openModal} setOpenModal={setOpenModal} tenantData={tenantData}/>}
    </>

  )
}
