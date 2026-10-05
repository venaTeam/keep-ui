import { useState } from "react";
import styles from "../Search.module.css";
import TenantFormModal from "./TenantFormModal";
import { Button } from "@/components/ui";

interface TenantButtonProps {
    icon: any;
    modalType: string;
    tenantData?: any;
    modalCompType: React.ElementType;
}

export default function TenantButton({icon, modalType, tenantData, modalCompType: ModalComponent}: TenantButtonProps) {

    const [openModal, setOpenModal] = useState(false);

  return (
    <>
    <Button icon={icon} className={styles.createUpdateTenant} onClick={() => setOpenModal(true)} variant={undefined} />
    {openModal && <ModalComponent modalType={modalType} openModal={openModal} setOpenModal={setOpenModal} tenantData={tenantData}/>}
    </>

  )
}
